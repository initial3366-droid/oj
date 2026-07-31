package com.qoj.module.judge.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.common.redis.RedisKeys;
import com.qoj.common.util.Utf8TextLimiter;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.entity.ContestProblemCaseScore;
import com.qoj.module.contest.entity.ContestProblemTestCase;
import com.qoj.module.contest.mapper.ContestProblemCaseScoreMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.mapper.ContestProblemTestCaseMapper;
import com.qoj.module.judge.JudgeCaseResult;
import com.qoj.module.judge.JudgeResult;
import com.qoj.module.judge.JudgeTask;
import com.qoj.module.judge.gojudge.GoJudgeService;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.submission.dto.JudgeResultCallbackRequest;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.service.JudgeCallbackService;
import com.qoj.module.ws.JudgeMessagePublisher;
import java.math.BigDecimal;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

/**
 * Claims queue entries for the embedded go-judge execution path.
 *
 * <p>CCPCOJ-owned scopes are excluded before claiming, so the pull-based contest
 * worker and go-judge can never race for the same submission. Database status
 * transitions remain the single source of truth for both paths.
 */
@Service
public class JudgeQueueScheduler {
    private static final Logger log = LoggerFactory.getLogger(JudgeQueueScheduler.class);

    private final SubmissionMapper submissionMapper;
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper problemTestCaseMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final ContestProblemTestCaseMapper contestProblemTestCaseMapper;
    private final ContestProblemCaseScoreMapper contestProblemCaseScoreMapper;
    private final GoJudgeService goJudgeService;
    private final JudgeCallbackService callbackService;
    private final JudgeMessagePublisher messagePublisher;
    private final ThreadPoolTaskExecutor judgeTaskExecutor;
    private final SystemSettingService settingService;
    private final StringRedisTemplate redisTemplate;
    private final String workerId;
    private long lastPollAt;

    public JudgeQueueScheduler(
        SubmissionMapper submissionMapper,
        ProblemMapper problemMapper,
        ProblemTestCaseMapper problemTestCaseMapper,
        ContestProblemMapper contestProblemMapper,
        ContestProblemTestCaseMapper contestProblemTestCaseMapper,
        ContestProblemCaseScoreMapper contestProblemCaseScoreMapper,
        GoJudgeService goJudgeService,
        JudgeCallbackService callbackService,
        JudgeMessagePublisher messagePublisher,
        ThreadPoolTaskExecutor judgeTaskExecutor,
        SystemSettingService settingService,
        StringRedisTemplate redisTemplate
    ) {
        this.submissionMapper = submissionMapper;
        this.problemMapper = problemMapper;
        this.problemTestCaseMapper = problemTestCaseMapper;
        this.contestProblemMapper = contestProblemMapper;
        this.contestProblemTestCaseMapper = contestProblemTestCaseMapper;
        this.contestProblemCaseScoreMapper = contestProblemCaseScoreMapper;
        this.goJudgeService = goJudgeService;
        this.callbackService = callbackService;
        this.messagePublisher = messagePublisher;
        this.judgeTaskExecutor = judgeTaskExecutor;
        this.settingService = settingService;
        this.redisTemplate = redisTemplate;
        this.workerId = generateWorkerId();
    }

    /**
     * 封装pollAndDispatch相关逻辑。从持久化层读取数据。
     */
    @Scheduled(fixedDelay = 200)
    public void pollAndDispatch() {
        try {
            JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
            if (!settings.enabled || !shouldPoll(settings.pollIntervalMs)) {
                return;
            }
            int slots = settings.maxConcurrent - Math.toIntExact(submissionMapper.countRunning());
            if (slots <= 0) {
                return;
            }
            int limit = Math.min(slots, settings.queueBatchSize);
            List<Submission> submissions = submissionMapper.selectWaitingForEmbeddedJudge(limit);
            for (Submission submission : submissions) {
                claimAndDispatch(submission);
            }
        } catch (Exception ex) {
            log.error("go-judge queue poll failed", ex);
        }
    }

    /**
     * 封装claimAndDispatch相关逻辑。从持久化层读取数据；结果依赖当前时间。
     */
    private void claimAndDispatch(Submission submission) {
        String originalStatus = submission.status;
        LocalDateTime now = LocalDateTime.now();
        int updated = submissionMapper.atomicClaim(
            submission.id,
            originalStatus,
            SubmissionStatus.JUDGING.name(),
            "GO_JUDGE",
            workerId,
            now
        );
        if (updated == 0) {
            return;
        }
        submission.status = SubmissionStatus.JUDGING.name();
        submission.judgeServer = "GO_JUDGE";
        submission.judgeWorkerId = workerId;
        submission.judgeStartTime = now;
        try {
            judgeTaskExecutor.submit(() -> execute(submission));
            messagePublisher.submissionChanged(submission.id, submission.status, null, null);
        } catch (TaskRejectedException ex) {
            int restored = submissionMapper.restoreRejectedEmbeddedClaim(
                submission.id, workerId, originalStatus, LocalDateTime.now());
            if (restored > 0) {
                messagePublisher.submissionChanged(submission.id, originalStatus, null, null);
                messagePublisher.submissionQueueUpdated();
            }
            log.warn("go-judge dispatch rejected for submission {}; restored={}", submission.id, restored);
        }
    }

    /**
     * 封装execute相关逻辑。从持久化层读取数据；可能调用外部判题或网关服务；结果依赖当前时间。
     */
    private void execute(Submission submission) {
        try {
            // Routing is an immutable submission snapshot. Runtime settings must
            // never move an already claimed task to another judge service.
            if (!"GO_JUDGE".equals(submission.judgeBackend)) {
                failDirectly(submission, "提交的判题路由无效");
                return;
            }
            JudgeTask task = buildTask(submission);
            JudgeResult result = task == null
                ? JudgeResult.systemError("题目未配置可用的隐藏测试点")
                : goJudgeService.judge(task);
            complete(submission, result);
        } catch (Exception ex) {
            log.error("go-judge execution failed for submission {}", submission.id, ex);
            failDirectly(submission, "go-judge 判题异常");
        } finally {
            submissionMapper.releaseWorker(submission.id, LocalDateTime.now());
        }
    }

    /**
     * 封装complete相关逻辑。执行持久化写入；读写 Redis 中的缓存、锁或限流状态；结果依赖当前时间。
     */
    private void complete(Submission submission, JudgeResult result) {
        JudgeResultCallbackRequest request = new JudgeResultCallbackRequest();
        request.submissionId = submission.id;
        request.status = result.status().name();
        request.timeUsed = result.maxTimeMs();
        request.memoryUsed = result.maxMemoryKb();
        request.score = score(submission, result);
        request.caseResults = callbackCases(submission, result.caseResults());
        callbackService.handleJudgeResult(request);

        Submission completed = submissionMapper.selectById(submission.id);
        if (completed == null) {
            return;
        }
        completed.judgeServer = "GO_JUDGE";
        completed.judgeMessage = result.compileOutput() == null || result.compileOutput().isBlank()
            ? null
            : Utf8TextLimiter.fitMysqlText(result.compileOutput());
        if (result.status() == SubmissionStatus.SE || result.status() == SubmissionStatus.FAILED) {
            completed.errorMessage = Utf8TextLimiter.fitMysqlText(completed.judgeMessage == null
                ? "go-judge 系统错误"
                : completed.judgeMessage);
        }
        completed.updatedAt = LocalDateTime.now();
        submissionMapper.updateById(completed);

        redisTemplate.delete(RedisKeys.judgePending(
            completed.userId,
            completed.contestProblemId == null ? completed.problemId : completed.contestProblemId,
            completed.contestId
        ));
        if (completed.contestId == null) {
            updateProblemAcRate(completed.problemId);
        }
        messagePublisher.submissionChanged(
            completed.id, completed.status, completed.timeUsed, completed.memoryUsed);
        messagePublisher.submissionQueueUpdated();
    }

    /**
     * 封装回调Cases相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private List<JudgeResultCallbackRequest.CaseResultDTO> callbackCases(
        Submission submission,
        List<JudgeCaseResult> cases
    ) {
        if (cases == null || cases.isEmpty()) {
            return List.of();
        }
        Map<Integer, Integer> configuredScores = caseScores(submission);
        List<JudgeResultCallbackRequest.CaseResultDTO> result = new ArrayList<>(cases.size());
        for (JudgeCaseResult item : cases) {
            int maxScore = configuredScores.getOrDefault(item.caseNo(), 1);
            JudgeResultCallbackRequest.CaseResultDTO dto = new JudgeResultCallbackRequest.CaseResultDTO();
            dto.caseNo = item.caseNo();
            dto.status = item.status().name();
            dto.maxScore = maxScore;
            dto.score = item.status() == SubmissionStatus.AC ? maxScore : 0;
            dto.timeUsed = item.timeMs();
            dto.memoryUsed = item.memoryKb();
            dto.inputPreview = item.inputPreview();
            dto.outputPreview = item.outputPreview();
            dto.expectedPreview = item.expectedPreview();
            dto.judgeMessage = item.message();
            result.add(dto);
        }
        return result;
    }

    private Integer score(Submission submission, JudgeResult result) {
        if (submission.contestId == null || submission.contestProblemId == null) {
            return null;
        }
        ContestProblem problem = contestProblemMapper.selectById(submission.contestProblemId);
        int fullScore = problem == null
            ? 100
            : positive(problem.score, positive(problem.fullScore, 100));
        Map<Integer, Integer> configuredScores = caseScores(submission);
        if (!configuredScores.isEmpty()) {
            int earned = result.caseResults() == null ? 0 : result.caseResults().stream()
                .filter(item -> item.status() == SubmissionStatus.AC)
                .mapToInt(item -> configuredScores.getOrDefault(item.caseNo(), 0))
                .sum();
            return Math.min(fullScore, earned);
        }
        long total = result.caseResults() == null ? 0 : result.caseResults().size();
        long passed = result.caseResults() == null ? 0 : result.caseResults().stream()
            .filter(item -> item.status() == SubmissionStatus.AC)
            .count();
        return total == 0 ? 0 : (int) Math.round(fullScore * passed / (double) total);
    }

    private Map<Integer, Integer> caseScores(Submission submission) {
        if (submission.contestId == null || submission.contestProblemId == null) {
            return Map.of();
        }
        Map<Integer, Integer> result = new HashMap<>();
        contestProblemCaseScoreMapper.selectList(
            new QueryWrapper<ContestProblemCaseScore>()
                .eq("contest_id", submission.contestId)
                .eq("problem_id", submission.contestProblemId)
        ).forEach(item -> result.put(item.caseNo, Math.max(0, item.score == null ? 0 : item.score)));
        return result;
    }

    private JudgeTask buildTask(Submission submission) {
        if (submission.contestProblemId != null) {
            ContestProblem problem = contestProblemMapper.selectById(submission.contestProblemId);
            if (problem == null) {
                return null;
            }
            List<ContestProblemTestCase> cases = contestProblemTestCaseMapper.selectList(
                new QueryWrapper<ContestProblemTestCase>()
                    .eq("contest_problem_id", submission.contestProblemId)
                    .eq("sample", false)
                    .orderByAsc("case_no")
            );
            /**
             * 封装task相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return task(
                submission,
                positive(problem.timeLimit, 1000),
                positive(problem.memoryLimit, 256),
                cases.stream().map(item -> new JudgeTask.TestCase(
                    item.caseNo, item.inputData, item.outputData)).toList()
            );
        }

        Problem problem = problemMapper.selectById(submission.problemId);
        if (problem == null) {
            return null;
        }
        List<ProblemTestCase> cases = problemTestCaseMapper.selectList(
            new QueryWrapper<ProblemTestCase>()
                .eq("problem_id", problem.id)
                .eq("sample", false)
                .orderByAsc("case_no")
        );
        /**
         * 封装task相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return task(
            submission,
            positive(problem.timeLimit, 1000),
            positive(problem.memoryLimit, 256),
            cases.stream().map(item -> new JudgeTask.TestCase(
                item.caseNo, item.inputData, item.outputData)).toList()
        );
    }

    private JudgeTask task(
        Submission submission,
        int timeLimit,
        int memoryLimit,
        List<JudgeTask.TestCase> cases
    ) {
        if (cases.isEmpty()) {
            return null;
        }
        /**
         * 封装判题Task相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new JudgeTask(
            submission.id,
            submission.language,
            submission.code,
            timeLimit,
            memoryLimit,
            cases
        );
    }

    private void updateProblemAcRate(Long problemId) {
        Long total = submissionMapper.countByProblemId(problemId);
        Long accepted = submissionMapper.countAcceptedByProblemId(problemId);
        Problem problem = problemMapper.selectById(problemId);
        if (problem == null) {
            return;
        }
        int rate = total == null || total == 0
            ? 0
            : (int) Math.round((accepted == null ? 0 : accepted) * 100.0 / total);
        problem.acRate = BigDecimal.valueOf(rate);
        problemMapper.updateById(problem);
        redisTemplate.delete(RedisKeys.problem(problemId));
    }

    private void failDirectly(Submission submission, String message) {
        LocalDateTime now = LocalDateTime.now();
        submission.status = SubmissionStatus.SE.name();
        submission.judgeServer = "GO_JUDGE";
        submission.judgeEndTime = now;
        submission.judgeMessage = Utf8TextLimiter.fitMysqlText(message);
        submission.errorMessage = Utf8TextLimiter.fitMysqlText(message);
        submission.updatedAt = now;
        submissionMapper.updateById(submission);
        messagePublisher.submissionChanged(submission.id, submission.status, null, null);
        messagePublisher.submissionQueueUpdated();
    }

    private int positive(Integer value, int fallback) {
        return value != null && value > 0 ? value : fallback;
    }

    private boolean shouldPoll(long intervalMs) {
        long now = System.currentTimeMillis();
        long delay = intervalMs > 0 ? intervalMs : 1000L;
        if (now - lastPollAt < delay) {
            return false;
        }
        lastPollAt = now;
        return true;
    }

    private String generateWorkerId() {
        try {
            return InetAddress.getLocalHost().getHostName()
                + "-gojudge-" + UUID.randomUUID().toString().substring(0, 8);
        } catch (UnknownHostException ex) {
            return "unknown-gojudge-" + UUID.randomUUID().toString().substring(0, 8);
        }
    }
}
