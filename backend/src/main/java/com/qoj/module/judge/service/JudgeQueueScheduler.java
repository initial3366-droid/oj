package com.qoj.module.judge.service;

import com.qoj.common.enums.SubmissionStatus;
import com.qoj.module.judge.DockerJudgeService;
import com.qoj.module.judge.JudgeCaseResult;
import com.qoj.module.judge.JudgeResult;
import com.qoj.module.judge.JudgeTask;
import com.qoj.module.judge.dto.DomjudgeSubmissionResponse;
import com.qoj.module.judge.service.LocalJudgeService;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.entity.SubmissionCaseResult;
import com.qoj.module.submission.mapper.SubmissionCaseResultMapper;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.service.UserProblemStatusService;
import com.qoj.module.user.service.UserScoreService;
import com.qoj.module.ws.JudgeMessagePublisher;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

/**
 * 判题队列调度器
 *
 * 核心调度逻辑：
 * 1. 每 poll-interval-ms 扫描一次 WAITING/PENDING/REJUDGE_PENDING 提交
 * 2. 统计当前 RUNNING/JUDGING/COMPILING 数量
 * 3. 可取任务数 = maxConcurrent - 当前运行数
 * 4. 每次最多取 queueBatchSize 条提交
 * 5. 原子更新状态为 JUDGING（乐观锁防止重复判题）
 * 6. 提交到固定大小线程池执行
 * 7. 任务结束后释放并发名额
 * 8. 异常时更新为 SYSTEM_ERROR
 */
@Service
public class JudgeQueueScheduler {
    private static final Logger log = LoggerFactory.getLogger(JudgeQueueScheduler.class);

    // DO NOT autowire JudgeService — we need specific implementations by mode
    private final SubmissionMapper submissionMapper;
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper problemTestCaseMapper;
    private final DomjudgeAdapter domjudgeAdapter;
    private final JudgeMessagePublisher judgeMessagePublisher;
    private final UserProblemStatusService userProblemStatusService;
    private final UserScoreService userScoreService;
    private final ThreadPoolTaskExecutor judgeTaskExecutor;
    private final SystemSettingService settingService;
    private final SubmissionCaseResultMapper submissionCaseResultMapper;
    private final String workerId;

    @Autowired(required = false)
    private DockerJudgeService dockerJudgeService;

    @Autowired(required = false)
    private LocalJudgeService localJudgeService;

    public JudgeQueueScheduler(
        SubmissionMapper submissionMapper,
        ProblemMapper problemMapper,
        ProblemTestCaseMapper problemTestCaseMapper,
        DomjudgeAdapter domjudgeAdapter,
        JudgeMessagePublisher judgeMessagePublisher,
        UserProblemStatusService userProblemStatusService,
        UserScoreService userScoreService,
        ThreadPoolTaskExecutor judgeTaskExecutor,
        SystemSettingService settingService,
        SubmissionCaseResultMapper submissionCaseResultMapper
    ) {
        this.submissionMapper = submissionMapper;
        this.problemMapper = problemMapper;
        this.problemTestCaseMapper = problemTestCaseMapper;
        this.domjudgeAdapter = domjudgeAdapter;
        this.judgeMessagePublisher = judgeMessagePublisher;
        this.userProblemStatusService = userProblemStatusService;
        this.userScoreService = userScoreService;
        this.judgeTaskExecutor = judgeTaskExecutor;
        this.settingService = settingService;
        this.submissionCaseResultMapper = submissionCaseResultMapper;
        this.workerId = generateWorkerId();
        JudgeSettingsVO judgeCfg = settingService.getJudgeSettings();
        log.info("JudgeQueueScheduler initialized: workerId={}, maxConcurrent={}, pollIntervalMs={}, threadPoolSize={}",
            workerId, judgeCfg.maxConcurrent, judgeCfg.pollIntervalMs, judgeCfg.threadPoolSize);
    }

    /**
     * 定时轮询待评测提交队列
     * 调度频率保持为短间隔，实际轮询间隔由数据库中的 judge.poll_interval_ms 控制。
     */
    @Scheduled(fixedDelay = 200)
    public void pollAndDispatch() {
        try {
            // 读取动态判题配置（存于 system_settings，运行时可变）
            JudgeSettingsVO judgeCfg = settingService.getJudgeSettings();
            if (!shouldPoll(judgeCfg.pollIntervalMs)) {
                return;
            }
            if (!judgeCfg.enabled) {
                return; // 判题开关关闭：停止派发新任务（已派发的任务仍在线程池内跑完）
            }
            int maxConcurrent = judgeCfg.maxConcurrent;
            int queueBatchSize = judgeCfg.queueBatchSize;

            // 1. 统计当前正在运行的判题任务数
            long runningCount = submissionMapper.countRunning();
            int availableSlots = maxConcurrent - (int) runningCount;

            if (availableSlots <= 0) {
                return; // 没有可用槽位
            }

            // 2. 可取任务数 = min(可用槽位, queueBatchSize)
            int fetchLimit = Math.min(availableSlots, queueBatchSize);

            // 3. 查询等待队列中的提交（按 priority DESC, submit_time ASC）
            List<Submission> waitingSubmissions = submissionMapper.selectWaiting(fetchLimit);

            if (waitingSubmissions.isEmpty()) {
                return;
            }

            log.debug("Poll phase: runningCount={}, availableSlots={}, fetched={}",
                runningCount, availableSlots, waitingSubmissions.size());

            // 4. 逐个原子认领任务并提交到线程池
            for (Submission submission : waitingSubmissions) {
                boolean claimed = claimAndDispatch(submission);
                if (!claimed) {
                    // 认领失败（可能被其他实例抢占），继续下一个
                    log.debug("Failed to claim submission {} — skipped (already claimed by another worker)",
                        submission.id);
                }
            }
        } catch (Exception ex) {
            log.error("JudgeQueueScheduler poll error", ex);
        }
    }

    /**
     * 原子认领任务并提交到线程池
     *
     * @return true 表示认领并提交成功
     */
    private boolean claimAndDispatch(Submission submission) {
        String currentStatus = submission.status;
        LocalDateTime startTime = LocalDateTime.now();
        JudgeSettingsVO judgeCfg = settingService.getJudgeSettings();
        String mode = submission.contestId == null ? judgeCfg.mode : judgeCfg.contestMode;
        String judgeServer = judgeServerName(mode);

        // 原子更新：从 WAITING/PENDING/REJUDGE_PENDING → JUDGING
        int updated = submissionMapper.atomicClaim(
            submission.id,
            currentStatus,
            SubmissionStatus.JUDGING.name(),
            judgeServer,
            workerId,
            startTime
        );

        if (updated == 0) {
            return false; // 乐观锁失败，可能已被其他 worker 认领
        }

        // 更新内存中的状态用于后续处理
        submission.status = SubmissionStatus.JUDGING.name();
        submission.judgeWorkerId = workerId;
        submission.judgeStartTime = startTime;
        submission.judgeServer = judgeServer;

        // 推送状态变更（JUDGING）
        judgeMessagePublisher.submissionChanged(
            submission.id, submission.status, submission.timeUsed, submission.memoryUsed);

        // 提交到线程池
        judgeTaskExecutor.submit(() -> executeJudge(submission));

        return true;
    }

    /**
     * 执行判题
     *
     * 根据 judge.mode 选择判题方式：
     * - domjudge：提交到 DOMjudge 远程判题
     * - docker：使用 Docker 容器本地判题
     *
     * 无论成功还是失败，都必须释放资源并更新状态。
     */
    private void executeJudge(Submission submission) {
        try {
            JudgeSettingsVO judgeCfg = settingService.getJudgeSettings();
            String mode = submission.contestId == null ? judgeCfg.mode : judgeCfg.contestMode;
            if ("docker".equalsIgnoreCase(mode)) {
                executeDockerJudge(submission);
            } else if ("unsafe-local".equalsIgnoreCase(mode)) {
                if (!judgeCfg.enableUnsafeLocalJudge) {
                    releaseAndFinalize(submission, SubmissionStatus.SE,
                        "不安全本地判题未启用", null, null);
                    return;
                }
                executeLocalJudge(submission);
            } else {
                executeDomjudgeSubmit(submission);
            }
        } catch (Exception ex) {
            log.error("Judge execution failed for submission {}", submission.id, ex);
            releaseAndFinalize(submission, SubmissionStatus.SE, "判题异常: " + ex.getMessage(), null, null);
        } finally {
            submissionMapper.releaseWorker(submission.id, LocalDateTime.now());
        }
    }

    /**
     * 本地判题：使用 LocalJudgeService 直接执行
     */
    private void executeLocalJudge(Submission submission) {
        if (localJudgeService == null) {
            releaseAndFinalize(submission, SubmissionStatus.SE,
                "本地判题服务未启用", null, null);
            return;
        }

        try {
            localJudgeService.judgeSubmission(submission.id);
        } catch (Exception ex) {
            log.error("Local judge failed for submission {}", submission.id, ex);
            releaseAndFinalize(submission, SubmissionStatus.SE,
                "本地判题异常: " + ex.getMessage(), null, null);
        }
    }

    /**
     * Docker 判题：构建 JudgeTask 并调用 DockerJudgeService
     */
    private void executeDockerJudge(Submission submission) {
        if (dockerJudgeService == null) {
            releaseAndFinalize(submission, SubmissionStatus.SE,
                "Docker judge service not available", null, null);
            return;
        }

        // 构建判题任务
        JudgeTask task = buildJudgeTask(submission);
        if (task == null) {
            releaseAndFinalize(submission, SubmissionStatus.SE,
                "无法构建判题任务", null, null);
            return;
        }

        // 执行判题
        JudgeResult result = dockerJudgeService.judge(task);
        saveDockerCaseResults(submission.id, result.caseResults());

        // 更新结果
        releaseAndFinalize(submission, result.status(), result.compileOutput(),
            result.maxTimeMs(), result.maxMemoryKb());

        // 更新用户题目状态和分数
        if (submission.contestId == null) {
            userProblemStatusService.recordJudged(submission);
            userScoreService.recompute(submission.userId);
        }

        // 推送结果
        judgeMessagePublisher.submissionChanged(
            submission.id,
            result.status().name(),
            result.maxTimeMs(),
            result.maxMemoryKb()
        );
    }

    private void saveDockerCaseResults(Long submissionId, List<JudgeCaseResult> caseResults) {
        submissionCaseResultMapper.delete(
            new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submissionId)
        );
        if (caseResults == null || caseResults.isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (JudgeCaseResult item : caseResults) {
            SubmissionCaseResult caseResult = new SubmissionCaseResult();
            caseResult.submissionId = submissionId;
            caseResult.caseNo = item.caseNo();
            caseResult.status = item.status().name();
            caseResult.timeUsed = item.timeMs();
            caseResult.memoryUsed = item.memoryKb();
            caseResult.judgeMessage = item.message();
            caseResult.score = item.status() == SubmissionStatus.AC ? 1 : 0;
            caseResult.maxScore = 1;
            caseResult.createdAt = now;
            submissionCaseResultMapper.insert(caseResult);
        }
    }

    /**
     * DOMjudge 判题：提交到远程判题服务器
     * JudgePollingService 会定期轮询 DOMjudge 获取结果
     */
    private void executeDomjudgeSubmit(Submission submission) {
        if (!domjudgeAdapter.enabled()) {
            releaseAndFinalize(submission, SubmissionStatus.SE,
                "DOMjudge 未启用", null, null);
            return;
        }

        DomjudgeSubmissionResponse response = domjudgeAdapter.submit(
            submission.contestId == null ? null : String.valueOf(submission.contestId),
            getDomjudgeProblemId(submission),
            submission.language,
            submission.code
        );

        if (response == null || response.submissionId() == null) {
            releaseAndFinalize(submission, SubmissionStatus.SE,
                "DOMjudge 提交失败", null, null);
            return;
        }

        submission.domjudgeSubmissionId = response.submissionId();
        submission.judgeServer = "DOMJUDGE";
        if (submission.judgeStartTime == null) {
            submission.judgeStartTime = LocalDateTime.now();
        }
        submission.updatedAt = LocalDateTime.now();
        submissionMapper.updateById(submission);

        // 推送状态
        judgeMessagePublisher.submissionChanged(
            submission.id, submission.status, submission.timeUsed, submission.memoryUsed);

        log.info("DOMjudge submitted: submissionId={}, domjudgeId={}",
            submission.id, response.submissionId());
    }

    /**
     * 释放任务并更新最终状态
     */
    private void releaseAndFinalize(Submission submission, SubmissionStatus finalStatus,
                                     String message, Integer timeUsed, Integer memoryUsed) {
        try {
            LocalDateTime finishedAt = LocalDateTime.now();
            submission.status = finalStatus.name();
            if (submission.judgeStartTime == null) {
                submission.judgeStartTime = finishedAt;
            }
            submission.judgeEndTime = finishedAt;
            submission.updatedAt = finishedAt;
            submission.judgeMessage = message;
            if (timeUsed != null) {
                submission.timeUsed = timeUsed;
            }
            if (memoryUsed != null) {
                submission.memoryUsed = memoryUsed;
            }
            if (finalStatus == SubmissionStatus.SE || finalStatus == SubmissionStatus.FAILED) {
                submission.errorMessage = message;
            }
            submissionMapper.updateById(submission);
            log.info("Judge complete: submissionId={}, status={}", submission.id, finalStatus);
        } catch (Exception ex) {
            log.error("Failed to update final status for submission {}", submission.id, ex);
        }
    }

    private JudgeTask buildJudgeTask(Submission submission) {
        Problem problem = problemMapper.selectById(submission.problemId);
        if (problem == null) {
            return null;
        }

        List<ProblemTestCase> testCases = problemTestCaseMapper.selectByProblemId(problem.id);
        if (testCases == null || testCases.isEmpty()) {
            return null;
        }

        int timeLimit = problem.timeLimit != null ? problem.timeLimit : 1000;
        int memoryLimit = problem.memoryLimit != null ? problem.memoryLimit : 256;

        List<JudgeTask.TestCase> taskCases = new ArrayList<>();
        for (ProblemTestCase tc : testCases) {
            taskCases.add(new JudgeTask.TestCase(tc.caseNo, tc.inputData, tc.outputData));
        }

        return new JudgeTask(
            submission.id,
            submission.language,
            submission.code,
            timeLimit,
            memoryLimit,
            taskCases
        );
    }

    private String getDomjudgeProblemId(Submission submission) {
        Problem problem = problemMapper.selectById(submission.problemId);
        if (problem != null && problem.domjudgeProblemId != null && !problem.domjudgeProblemId.isBlank()) {
            return problem.domjudgeProblemId;
        }
        return String.valueOf(submission.problemId);
    }

    private String generateWorkerId() {
        String host;
        try {
            host = InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException ex) {
            host = "unknown";
        }
        return host + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private long lastPollAt = 0L;

    private boolean shouldPoll(long intervalMs) {
        long now = System.currentTimeMillis();
        long delay = intervalMs > 0 ? intervalMs : 1000L;
        if (now - lastPollAt < delay) {
            return false;
        }
        lastPollAt = now;
        return true;
    }

    private String judgeServerName(String mode) {
        if ("docker".equalsIgnoreCase(mode)) {
            return "DOCKER";
        }
        if ("unsafe-local".equalsIgnoreCase(mode)) {
            return "LOCAL";
        }
        return "DOMJUDGE";
    }
}
