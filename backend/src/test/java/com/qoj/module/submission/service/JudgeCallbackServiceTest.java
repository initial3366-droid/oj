package com.qoj.module.submission.service;

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
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 判题回调Service测试类。验证关键业务规则、异常边界及回归场景。
 */
@ExtendWith(MockitoExtension.class)
class JudgeCallbackServiceTest {
    @Mock private SubmissionMapper submissionMapper;
    @Mock private SubmissionCaseResultMapper caseResultMapper;
    @Mock private ContestMapper contestMapper;
    @Mock private ContestAcmRankService acmRankService;
    @Mock private ContestOiRankService oiRankService;
    @Mock private UserProblemStatusService userProblemStatusService;
    @Mock private UserScoreService userScoreService;

    private JudgeCallbackService service;

    /**
     * 封装setUp相关逻辑。从持久化层读取数据。
     */
    @BeforeEach
    void setUp() {
        service = new JudgeCallbackService(
            submissionMapper,
            caseResultMapper,
            contestMapper,
            acmRankService,
            oiRankService,
            userProblemStatusService,
            userScoreService
        );
    }

    /**
     * 封装outputLimit结果IsFinal相关逻辑。执行持久化写入。
     */
    @Test
    void outputLimitResultIsFinal() {
        Submission submission = submission("RUNNING");
        when(submissionMapper.selectByIdForUpdate(1L)).thenReturn(submission);

        JudgeResultCallbackRequest request = new JudgeResultCallbackRequest();
        request.submissionId = 1L;
        request.status = "OUTPUT_LIMIT_EXCEEDED";
        service.handleJudgeResult(request);

        ArgumentCaptor<Submission> saved = ArgumentCaptor.forClass(Submission.class);
        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(submissionMapper).updateById(saved.capture());
        assertEquals("NOO", saved.getValue().status);
        assertNotNull(saved.getValue().judgeEndTime);
        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(caseResultMapper).delete(any());
        verify(userProblemStatusService).recordJudged(submission);
        verify(userScoreService).recompute(2L);
    }

    /**
     * 封装late结果CannotOverwriteFinal提交相关逻辑。执行持久化写入。
     */
    @Test
    void lateResultCannotOverwriteFinalSubmission() {
        Submission submission = submission("AC");
        when(submissionMapper.selectByIdForUpdate(1L)).thenReturn(submission);

        JudgeResultCallbackRequest request = new JudgeResultCallbackRequest();
        request.submissionId = 1L;
        request.status = "WA";
        service.handleJudgeResult(request);

        verify(submissionMapper, never()).updateById(org.mockito.ArgumentMatchers.isA(Submission.class));
    }

    /**
     * 封装测试点ResultsReplacePreviousAttemptAndAreNormalized相关逻辑。执行持久化写入。
     */
    @Test
    void caseResultsReplacePreviousAttemptAndAreNormalized() {
        Submission submission = submission("RUNNING");
        when(submissionMapper.selectByIdForUpdate(1L)).thenReturn(submission);

        JudgeResultCallbackRequest.CaseResultDTO item = new JudgeResultCallbackRequest.CaseResultDTO();
        item.caseNo = 1;
        item.status = "accepted";
        item.timeUsed = 12;
        item.memoryUsed = 1024;
        item.score = 10;
        item.maxScore = 10;
        JudgeResultCallbackRequest request = new JudgeResultCallbackRequest();
        request.submissionId = 1L;
        request.status = "AC";
        request.caseResults = List.of(item);

        service.handleJudgeResult(request);

        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(caseResultMapper).delete(any());
        ArgumentCaptor<SubmissionCaseResult> caseCaptor = ArgumentCaptor.forClass(SubmissionCaseResult.class);
        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(caseResultMapper).insert(caseCaptor.capture());
        assertEquals("AC", caseCaptor.getValue().status);
        assertNotNull(caseCaptor.getValue().createdAt);
    }

    /**
     * 封装empty测试点ResultsClearPreviousAttemptWithoutInsertingRows相关逻辑。执行持久化写入。
     */
    @Test
    void emptyCaseResultsClearPreviousAttemptWithoutInsertingRows() {
        Submission submission = submission("RUNNING");
        when(submissionMapper.selectByIdForUpdate(1L)).thenReturn(submission);

        JudgeResultCallbackRequest request = new JudgeResultCallbackRequest();
        request.submissionId = 1L;
        request.status = "CE";
        request.caseResults = List.of();

        service.handleJudgeResult(request);

        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(caseResultMapper).delete(any());
        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(caseResultMapper, never()).insert(
            org.mockito.ArgumentMatchers.isA(SubmissionCaseResult.class));
    }

    /**
     * 封装rejudgeRebuilds比赛排名InsteadOfDoubleCounting相关逻辑。执行持久化写入。
     */
    @Test
    void rejudgeRebuildsContestRankInsteadOfDoubleCounting() {
        Submission submission = submission("RUNNING");
        submission.contestId = 7L;
        submission.participantId = 8L;
        submission.isRejudged = true;
        when(submissionMapper.selectByIdForUpdate(1L)).thenReturn(submission);
        Contest contest = new Contest();
        contest.type = "ACM";
        contest.scoringMode = "ACM";
        when(contestMapper.selectById(7L)).thenReturn(contest);

        JudgeResultCallbackRequest request = new JudgeResultCallbackRequest();
        request.submissionId = 1L;
        request.status = "AC";
        service.handleJudgeResult(request);

        verify(acmRankService).rebuildRank(7L);
        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(acmRankService, never()).updateRankAfterJudge(any());
    }

    /**
     * 封装提交相关逻辑。直接返回当前实例保存的提交，不产生额外的数据写入。
     */
    private Submission submission(String status) {
        Submission submission = new Submission();
        submission.id = 1L;
        submission.userId = 2L;
        submission.problemId = 3L;
        submission.status = status;
        return submission;
    }
}
