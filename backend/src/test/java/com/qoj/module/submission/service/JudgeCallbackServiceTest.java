package com.qoj.module.submission.service;

import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.service.ContestAcmRankService;
import com.qoj.module.contest.service.ContestOiRankService;
import com.qoj.module.submission.dto.JudgeResultCallbackRequest;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionCaseResultMapper;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.service.UserScoreService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    @Test
    void outputLimitResultIsFinal() {
        Submission submission = new Submission();
        submission.id = 1L;
        submission.userId = 2L;
        submission.problemId = 3L;
        submission.status = "RUNNING";
        when(submissionMapper.selectById(1L)).thenReturn(submission);

        JudgeResultCallbackRequest request = new JudgeResultCallbackRequest();
        request.submissionId = 1L;
        request.status = "NOO";
        service.handleJudgeResult(request);

        ArgumentCaptor<Submission> saved = ArgumentCaptor.forClass(Submission.class);
        verify(submissionMapper).updateById(saved.capture());
        assertNotNull(saved.getValue().judgeEndTime);
        verify(userProblemStatusService).recordJudged(submission);
        verify(userScoreService).recompute(2L);
    }

    @Test
    void lateResultCannotOverwriteFinalSubmission() {
        Submission submission = new Submission();
        submission.id = 1L;
        submission.status = "AC";
        when(submissionMapper.selectById(1L)).thenReturn(submission);

        JudgeResultCallbackRequest request = new JudgeResultCallbackRequest();
        request.submissionId = 1L;
        request.status = "WA";
        service.handleJudgeResult(request);

        verify(submissionMapper, never()).updateById(submission);
    }
}
