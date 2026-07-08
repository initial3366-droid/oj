package com.qoj.module.judge.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.service.ContestAcmRankService;
import com.qoj.module.contest.service.ContestOiRankService;
import com.qoj.module.contest.service.ContestService;
import com.qoj.module.judge.dto.DomjudgeJudgementResult;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.service.UserProblemStatusService;
import com.qoj.module.user.service.UserScoreService;
import com.qoj.module.ws.JudgeMessagePublisher;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JudgePollingService {
    private final SubmissionMapper submissionMapper;
    private final ContestMapper contestMapper;
    private final ProblemMapper problemMapper;
    private final DomjudgeAdapter domjudgeAdapter;
    private final JudgeMessagePublisher judgeMessagePublisher;
    private final ContestService contestService;
    private final ContestAcmRankService contestAcmRankService;
    private final ContestOiRankService contestOiRankService;
    private final UserProblemStatusService userProblemStatusService;
    private final StringRedisTemplate redisTemplate;
    private final UserScoreService userScoreService;
    private final SystemSettingService settingService;
    private long lastPollAt = 0L;

    public JudgePollingService(
        SubmissionMapper submissionMapper,
        ContestMapper contestMapper,
        ProblemMapper problemMapper,
        DomjudgeAdapter domjudgeAdapter,
        JudgeMessagePublisher judgeMessagePublisher,
        ContestService contestService,
        ContestAcmRankService contestAcmRankService,
        ContestOiRankService contestOiRankService,
        UserProblemStatusService userProblemStatusService,
        StringRedisTemplate redisTemplate,
        UserScoreService userScoreService,
        SystemSettingService settingService
    ) {
        this.submissionMapper = submissionMapper;
        this.contestMapper = contestMapper;
        this.problemMapper = problemMapper;
        this.domjudgeAdapter = domjudgeAdapter;
        this.judgeMessagePublisher = judgeMessagePublisher;
        this.contestService = contestService;
        this.contestAcmRankService = contestAcmRankService;
        this.contestOiRankService = contestOiRankService;
        this.userProblemStatusService = userProblemStatusService;
        this.redisTemplate = redisTemplate;
        this.userScoreService = userScoreService;
        this.settingService = settingService;
    }

    @Scheduled(fixedDelay = 500)
    public void pollPendingSubmissions() {
        JudgeSettingsVO judgeCfg = settingService.getJudgeSettings();
        if (!shouldPoll(judgeCfg.domjudgePollIntervalMs)) {
            return;
        }
        if (!domjudgeAdapter.enabled()) {
            return;
        }
        List<Submission> submissions = submissionMapper
            .selectPage(
                Page.of(1, 50),
                new QueryWrapper<Submission>()
                    .in("status", List.of(SubmissionStatus.PENDING.name(), SubmissionStatus.JUDGING.name()))
                    .isNotNull("domjudge_submission_id")
                    .orderByAsc("created_at")
            )
            .getRecords();
        for (Submission submission : submissions) {
            pollOne(submission);
        }
    }

    @Transactional
    public void pollOne(Submission submission) {
        DomjudgeJudgementResult result = domjudgeAdapter.fetchJudgement(
            submission.contestId == null ? null : String.valueOf(submission.contestId),
            submission.domjudgeSubmissionId
        );
        if (result == null) {
            return;
        }
        SubmissionStatus mapped = mapStatus(result);
        if (!result.finalResult() && mapped == SubmissionStatus.JUDGING) {
            LocalDateTime now = LocalDateTime.now();
            submission.status = SubmissionStatus.JUDGING.name();
            if (submission.judgeStartTime == null) {
                submission.judgeStartTime = now;
            }
            submission.judgeServer = submission.judgeServer == null ? "DOMJUDGE" : submission.judgeServer;
            submission.updatedAt = now;
            submissionMapper.updateById(submission);
            judgeMessagePublisher.submissionChanged(submission.id, submission.status, submission.timeUsed, submission.memoryUsed);
            return;
        }
        boolean firstAccepted = mapped == SubmissionStatus.AC && isFirstAccepted(submission);
        LocalDateTime finishedAt = LocalDateTime.now();
        submission.status = mapped.name();
        Integer timeUsed = positiveOrNull(result.timeUsed());
        Integer memoryUsed = positiveOrNull(result.memoryUsed());
        if (timeUsed != null) {
            submission.timeUsed = timeUsed;
        }
        if (memoryUsed != null) {
            submission.memoryUsed = memoryUsed;
        }
        if (submission.judgeStartTime == null) {
            submission.judgeStartTime = finishedAt;
        }
        submission.judgeEndTime = finishedAt;
        submission.judgeServer = submission.judgeServer == null ? "DOMJUDGE" : submission.judgeServer;
        submission.updatedAt = finishedAt;
        if (mapped == SubmissionStatus.SE) {
            submission.errorMessage = "DOMjudge returned system error";
        }
        submissionMapper.updateById(submission);
        if (submission.contestId == null) {
            userProblemStatusService.recordJudged(submission);
            updateProblemAcRate(submission.problemId);
            userScoreService.recompute(submission.userId);
        }
        redisTemplate.delete(RedisKeys.judgePending(submission.userId, contestProblemKey(submission), submission.contestId));
        updateContestRank(submission);
        judgeMessagePublisher.submissionChanged(submission.id, submission.status, submission.timeUsed, submission.memoryUsed);
    }

    private Integer positiveOrNull(Integer value) {
        return value != null && value > 0 ? value : null;
    }

    private SubmissionStatus mapStatus(DomjudgeJudgementResult result) {
        String type = result.judgementTypeId();
        if (type == null || type.isBlank() || "PENDING".equals(type) || "JUDGING".equals(type)) {
            return SubmissionStatus.JUDGING;
        }
        return switch (type) {
            case "CORRECT" -> SubmissionStatus.AC;
            case "WRONG-ANSWER" -> SubmissionStatus.WA;
            case "TIME-LIMIT" -> SubmissionStatus.TLE;
            case "MEMORY-LIMIT" -> SubmissionStatus.MLE;
            case "RUN-ERROR" -> SubmissionStatus.RE;
            case "COMPILER-ERROR" -> SubmissionStatus.CE;
            case "NO-OUTPUT" -> SubmissionStatus.NOO;
            default -> SubmissionStatus.RE;
        };
    }

    private boolean isFirstAccepted(Submission submission) {
        QueryWrapper<Submission> wrapper = new QueryWrapper<Submission>()
            .eq("user_id", submission.userId)
            .eq("status", SubmissionStatus.AC.name());
        if (submission.contestId == null) {
            wrapper.isNull("contest_id");
            wrapper.eq("problem_id", submission.problemId);
        } else {
            wrapper.eq("contest_id", submission.contestId);
            if (submission.contestProblemId != null) {
                wrapper.eq("contest_problem_id", submission.contestProblemId);
            } else {
                wrapper.eq("problem_id", submission.problemId);
            }
        }
        return submissionMapper.selectCount(wrapper) == 0;
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

    /**
     * 更新比赛榜单（使用新的 ACM/OI 排名系统）
     */
    private void updateContestRank(Submission submission) {
        if (submission.contestId == null) {
            return;
        }

        Contest contest = contestMapper.selectById(submission.contestId);
        if (contest == null) {
            return;
        }

        if ("ACM".equals(contest.type)) {
            contestAcmRankService.updateRankAfterJudge(submission);
        } else if ("OI".equals(contest.type)) {
            contestOiRankService.updateRankAfterJudge(submission);
        }
    }

    private Long contestProblemKey(Submission submission) {
        return submission.contestProblemId == null ? submission.problemId : submission.contestProblemId;
    }

    private boolean shouldPoll(long intervalMs) {
        long now = System.currentTimeMillis();
        long delay = intervalMs > 0 ? intervalMs : 2000L;
        if (now - lastPollAt < delay) {
            return false;
        }
        lastPollAt = now;
        return true;
    }
}
