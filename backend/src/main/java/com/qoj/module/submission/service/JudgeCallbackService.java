package com.qoj.module.submission.service;

import com.qoj.common.exception.BizException;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class JudgeCallbackService {
    private final SubmissionMapper submissionMapper;
    private final SubmissionCaseResultMapper caseResultMapper;
    private final ContestMapper contestMapper;
    private final ContestAcmRankService acmRankService;
    private final ContestOiRankService oiRankService;
    private final UserProblemStatusService userProblemStatusService;
    private final UserScoreService userScoreService;

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
     * 判题结果回调（幂等）
     */
    @Transactional(rollbackFor = Exception.class)
    public void handleJudgeResult(JudgeResultCallbackRequest request) {
        if (request.submissionId == null) {
            throw new BizException(400, "submissionId 不能为空");
        }

        Submission submission = submissionMapper.selectById(request.submissionId);
        if (submission == null) {
            throw new BizException(404, "提交记录不存在");
        }

        // 幂等检查：如果已经是终态且状态未变化，直接返回
        if (isFinalStatus(submission.status) && submission.status.equals(request.status)) {
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

        // 更新提交主记录
        submission.status = request.status;
        submission.timeUsed = timeUsed;
        submission.memoryUsed = memoryUsed;
        submission.score = request.score;
        if (submission.judgeStartTime == null) {
            submission.judgeStartTime = now;
        }
        if (isFinalStatus(request.status)) {
            submission.judgeEndTime = now;
        }
        submission.judgeServer = submission.judgeServer == null ? "CALLBACK" : submission.judgeServer;
        if ("SE".equals(request.status) || "SYSTEM_ERROR".equals(request.status) || "FAILED".equals(request.status)) {
            submission.errorMessage = request.status;
        }
        submission.updatedAt = now;
        submissionMapper.updateById(submission);

        // 保存测试用例结果
        if (request.caseResults != null && !request.caseResults.isEmpty()) {
            List<SubmissionCaseResult> caseResults = new ArrayList<>();
            for (JudgeResultCallbackRequest.CaseResultDTO caseDto : request.caseResults) {
                SubmissionCaseResult caseResult = new SubmissionCaseResult();
                caseResult.submissionId = submission.id;
                caseResult.caseNo = caseDto.caseNo;
                caseResult.subtaskNo = caseDto.subtaskNo;
                caseResult.status = caseDto.status;
                caseResult.score = caseDto.score;
                caseResult.maxScore = caseDto.maxScore;
                caseResult.timeUsed = caseDto.timeUsed;
                caseResult.memoryUsed = caseDto.memoryUsed;
                caseResults.add(caseResult);
            }

            // 批量插入测试用例结果
            for (SubmissionCaseResult caseResult : caseResults) {
                caseResultMapper.insert(caseResult);
            }
        }

        // 如果是比赛提交，更新排名
        if (submission.contestId != null && submission.participantId != null) {
            Contest contest = contestMapper.selectById(submission.contestId);
            if (contest != null) {
                String scoringMode = contest.scoringMode != null ? contest.scoringMode : contest.type;

                if ("ACM".equals(scoringMode)) {
                    acmRankService.updateRankAfterJudge(submission);
                } else if ("OI".equals(scoringMode)) {
                    oiRankService.updateRankAfterJudge(submission);
                }
            }
        } else if (isFinalStatus(request.status)) {
            userProblemStatusService.recordJudged(submission);
            userScoreService.recompute(submission.userId);
        }
    }

    /**
     * 判断是否为终态
     */
    private boolean isFinalStatus(String status) {
        if (status == null) {
            return false;
        }
        return status.equals("AC") || status.equals("ACCEPTED")
            || status.equals("WA") || status.equals("WRONG_ANSWER")
            || status.equals("TLE") || status.equals("TIME_LIMIT_EXCEEDED")
            || status.equals("MLE") || status.equals("MEMORY_LIMIT_EXCEEDED")
            || status.equals("RE") || status.equals("RUNTIME_ERROR")
            || status.equals("CE") || status.equals("COMPILE_ERROR")
            || status.equals("SE") || status.equals("SYSTEM_ERROR")
            || status.equals("FAILED");
    }

    private Integer maxCaseTimeUsed(List<JudgeResultCallbackRequest.CaseResultDTO> caseResults) {
        if (caseResults == null || caseResults.isEmpty()) {
            return null;
        }
        Integer maxTimeUsed = null;
        for (JudgeResultCallbackRequest.CaseResultDTO item : caseResults) {
            Integer timeUsed = positiveOrNull(item.timeUsed);
            if (timeUsed != null && (maxTimeUsed == null || timeUsed > maxTimeUsed)) {
                maxTimeUsed = timeUsed;
            }
        }
        return maxTimeUsed;
    }

    private Integer maxCaseMemoryUsed(List<JudgeResultCallbackRequest.CaseResultDTO> caseResults) {
        if (caseResults == null || caseResults.isEmpty()) {
            return null;
        }
        Integer maxMemoryUsed = null;
        for (JudgeResultCallbackRequest.CaseResultDTO item : caseResults) {
            Integer memoryUsed = positiveOrNull(item.memoryUsed);
            if (memoryUsed != null && (maxMemoryUsed == null || memoryUsed > maxMemoryUsed)) {
                maxMemoryUsed = memoryUsed;
            }
        }
        return maxMemoryUsed;
    }

    private Integer positiveOrNull(Integer value) {
        return value != null && value > 0 ? value : null;
    }
}
