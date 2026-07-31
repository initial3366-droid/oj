package com.qoj.module.submission.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.exception.BizException;
import com.qoj.common.util.Utf8TextLimiter;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.service.ContestAcmRankService;
import com.qoj.module.contest.service.ContestOiRankService;
import com.qoj.module.submission.dto.JudgeResultCallbackRequest;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.entity.SubmissionCaseResult;
import com.qoj.module.submission.mapper.SubmissionCaseResultMapper;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.service.UserScoreService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Applies normalized judge results to QOJ state and ranking caches.
 *
 * <p>The submission row is locked before mutation. This prevents a late result
 * from overwriting a completed or rejudged submission.
 */
@Service
public class JudgeCallbackService {
    private final SubmissionMapper submissionMapper;
    private final SubmissionCaseResultMapper caseResultMapper;
    private final ContestMapper contestMapper;
    private final ContestAcmRankService acmRankService;
    private final ContestOiRankService oiRankService;
    private final UserProblemStatusService userProblemStatusService;
    private final UserScoreService userScoreService;

    /**
     * 构造 判题回调Service 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public JudgeCallbackService(
        SubmissionMapper submissionMapper,
        SubmissionCaseResultMapper caseResultMapper,
        ContestMapper contestMapper,
        ContestAcmRankService acmRankService,
        ContestOiRankService oiRankService,
        UserProblemStatusService userProblemStatusService,
        UserScoreService userScoreService
    ) {
        this.submissionMapper = submissionMapper;
        this.caseResultMapper = caseResultMapper;
        this.contestMapper = contestMapper;
        this.acmRankService = acmRankService;
        this.oiRankService = oiRankService;
        this.userProblemStatusService = userProblemStatusService;
        this.userScoreService = userScoreService;
    }

    /**
     * Handles one result idempotently. Terminal submissions are immutable until
     * an explicit rejudge resets their status to REJUDGE_PENDING.
     */
    @Transactional(rollbackFor = Exception.class)
    public void handleJudgeResult(JudgeResultCallbackRequest request) {
        if (request == null || request.submissionId == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "submissionId 不能为空");
        }
        String normalizedStatus = normalizeStatus(request.status);
        if (normalizedStatus == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "判题状态无效");
        }

        Submission submission = submissionMapper.selectByIdForUpdate(request.submissionId);
        if (submission == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "提交记录不存在");
        }
        if (isFinalStatus(submission.status)) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        Integer timeUsed = positiveOrNull(request.timeUsed);
        if (timeUsed == null) {
            timeUsed = maxCaseTimeUsed(request.caseResults);
        }
        Integer memoryUsed = positiveOrNull(request.memoryUsed);
        if (memoryUsed == null) {
            memoryUsed = maxCaseMemoryUsed(request.caseResults);
        }

        submission.status = normalizedStatus;
        submission.timeUsed = timeUsed;
        submission.memoryUsed = memoryUsed;
        submission.score = nonNegativeOrNull(request.score);
        if (submission.judgeStartTime == null) {
            submission.judgeStartTime = now;
        }
        if (isFinalStatus(normalizedStatus)) {
            submission.judgeEndTime = now;
        }
        submission.judgeServer = submission.judgeServer == null ? "CALLBACK" : submission.judgeServer;
        if ("SE".equals(normalizedStatus) || "FAILED".equals(normalizedStatus)) {
            submission.errorMessage = Utf8TextLimiter.fitMysqlText(normalizedStatus);
        } else {
            submission.errorMessage = null;
        }
        submission.updatedAt = now;
        submissionMapper.updateById(submission);

        replaceCaseResults(submission.id, request.caseResults, now);
        updateDerivedState(submission, normalizedStatus);
    }

    private void replaceCaseResults(
        Long submissionId,
        List<JudgeResultCallbackRequest.CaseResultDTO> requestedCases,
        LocalDateTime createdAt
    ) {
        caseResultMapper.delete(
            new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submissionId)
        );
        if (requestedCases == null || requestedCases.isEmpty()) {
            return;
        }
        List<SubmissionCaseResult> caseResults = new ArrayList<>();
        for (JudgeResultCallbackRequest.CaseResultDTO item : requestedCases) {
            if (item == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(400, "测试点结果不能为空");
            }
            String caseStatus = normalizeStatus(item.status);
            if (caseStatus == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(400, "测试点判题状态无效");
            }
            SubmissionCaseResult caseResult = new SubmissionCaseResult();
            caseResult.submissionId = submissionId;
            caseResult.caseNo = item.caseNo;
            caseResult.subtaskNo = item.subtaskNo;
            caseResult.status = caseStatus;
            caseResult.score = nonNegativeOrNull(item.score);
            caseResult.maxScore = nonNegativeOrNull(item.maxScore);
            caseResult.timeUsed = positiveOrNull(item.timeUsed);
            caseResult.memoryUsed = positiveOrNull(item.memoryUsed);
            caseResult.inputPreview = preview(item.inputPreview);
            caseResult.outputPreview = preview(item.outputPreview);
            caseResult.expectedPreview = preview(item.expectedPreview);
            caseResult.judgeMessage = Utf8TextLimiter.fitMysqlText(item.judgeMessage);
            caseResult.createdAt = createdAt;
            caseResults.add(caseResult);
        }
        for (SubmissionCaseResult caseResult : caseResults) {
            caseResultMapper.insert(caseResult);
        }
    }

    private void updateDerivedState(Submission submission, String normalizedStatus) {
        if (!isFinalStatus(normalizedStatus)) {
            return;
        }
        if (submission.contestId == null) {
            userProblemStatusService.recordJudged(submission);
            userScoreService.recompute(submission.userId);
            return;
        }
        if (submission.participantId == null) {
            return;
        }

        Contest contest = contestMapper.selectById(submission.contestId);
        if (contest == null) {
            return;
        }
        String scoringMode = contest.scoringMode != null ? contest.scoringMode : contest.type;
        if ("ACM".equals(scoringMode)) {
            if (Boolean.TRUE.equals(submission.isRejudged)) {
                acmRankService.rebuildRank(submission.contestId);
            } else {
                acmRankService.updateRankAfterJudge(submission);
            }
        } else if ("OI".equals(scoringMode)) {
            if (Boolean.TRUE.equals(submission.isRejudged)) {
                oiRankService.rebuildRank(submission.contestId);
            } else {
                oiRankService.updateRankAfterJudge(submission);
            }
        }
    }

    private boolean isFinalStatus(String status) {
        String normalized = normalizeStatus(status);
        return normalized != null && switch (normalized) {
            case "AC", "WA", "TLE", "MLE", "RE", "CE", "NOO", "SE", "FAILED" -> true;
            default -> false;
        };
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        return switch (normalized) {
            case "WAITING", "PENDING", "JUDGING", "COMPILING", "RUNNING", "REJUDGE_PENDING" -> normalized;
            case "AC", "ACCEPTED" -> "AC";
            case "WA", "WRONG_ANSWER" -> "WA";
            case "TLE", "TIME_LIMIT_EXCEEDED" -> "TLE";
            case "MLE", "MEMORY_LIMIT_EXCEEDED" -> "MLE";
            case "RE", "RUNTIME_ERROR" -> "RE";
            case "CE", "COMPILE_ERROR", "COMPILATION_ERROR" -> "CE";
            case "NOO", "NO_OUTPUT", "OUTPUT_LIMIT_EXCEEDED" -> "NOO";
            case "SE", "SYSTEM_ERROR", "INTERNAL_ERROR" -> "SE";
            case "FAILED" -> "FAILED";
            default -> null;
        };
    }

    private Integer maxCaseTimeUsed(List<JudgeResultCallbackRequest.CaseResultDTO> caseResults) {
        if (caseResults == null || caseResults.isEmpty()) {
            return null;
        }
        Integer maximum = null;
        for (JudgeResultCallbackRequest.CaseResultDTO item : caseResults) {
            if (item == null) {
                continue;
            }
            Integer value = positiveOrNull(item.timeUsed);
            if (value != null && (maximum == null || value > maximum)) {
                maximum = value;
            }
        }
        return maximum;
    }

    private String preview(String value) {
        if (value == null || value.length() <= 200) {
            return value;
        }
        return value.substring(0, 200) + "...";
    }

    private Integer maxCaseMemoryUsed(List<JudgeResultCallbackRequest.CaseResultDTO> caseResults) {
        if (caseResults == null || caseResults.isEmpty()) {
            return null;
        }
        Integer maximum = null;
        for (JudgeResultCallbackRequest.CaseResultDTO item : caseResults) {
            if (item == null) {
                continue;
            }
            Integer value = positiveOrNull(item.memoryUsed);
            if (value != null && (maximum == null || value > maximum)) {
                maximum = value;
            }
        }
        return maximum;
    }

    private Integer positiveOrNull(Integer value) {
        return value != null && value > 0 ? value : null;
    }

    private Integer nonNegativeOrNull(Integer value) {
        return value == null ? null : Math.max(0, value);
    }
}
