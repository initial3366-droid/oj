package com.qoj.module.judge.service;

import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.mapper.ContestProblemTestCaseMapper;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.submission.dto.JudgeResultCallbackRequest;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.service.JudgeCallbackService;
import com.qoj.module.ws.JudgeMessagePublisher;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class CcpcojJudgeGatewayServiceTest {
    @Mock private SubmissionMapper submissionMapper;
    @Mock private ProblemMapper problemMapper;
    @Mock private ProblemTestCaseMapper problemTestCaseMapper;
    @Mock private ContestProblemMapper contestProblemMapper;
    @Mock private ContestProblemTestCaseMapper contestProblemTestCaseMapper;
    @Mock private SystemSettingService settingService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private JudgeCallbackService callbackService;
    @Mock private JudgeMessagePublisher messagePublisher;

    private CcpcojJudgeGatewayService service;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        service = new CcpcojJudgeGatewayService(
            submissionMapper,
            problemMapper,
            problemTestCaseMapper,
            contestProblemMapper,
            contestProblemTestCaseMapper,
            settingService,
            redisTemplate,
            callbackService,
            messagePublisher
        );
    }

    @Test
    void solutionInfoUsesStableVirtualContestProblemId() {
        Submission submission = new Submission();
        submission.id = 7L;
        submission.problemId = 3L;
        submission.contestProblemId = 9L;
        submission.userId = 5L;
        submission.contestId = 4L;
        submission.language = "cpp";
        when(submissionMapper.selectById(7L)).thenReturn(submission);

        assertEquals("19\n5\n1\n4\n", service.solutionInfo(7L));
    }

    @Test
    void problemInfoConvertsMillisecondsToSeconds() {
        Problem problem = new Problem();
        problem.id = 5L;
        problem.timeLimit = 1500;
        problem.memoryLimit = 256;
        when(problemMapper.selectById(5L)).thenReturn(problem);

        assertEquals("1.5\n256\n0\n", service.problemInfo(10L));
    }

    @Test
    void pendingOnlyReturnsLanguagesSupportedByWorker() {
        JudgeSettingsVO settings = new JudgeSettingsVO();
        settings.enabled = true;
        settings.mode = "ccpcoj";
        settings.contestMode = "docker";
        settings.maxConcurrent = 2;
        settings.ccpcojStaleTaskMinutes = 15;
        when(settingService.getJudgeRuntimeSettings()).thenReturn(settings);

        Submission cpp = new Submission();
        cpp.id = 1L;
        cpp.language = "cpp";
        when(submissionMapper.selectWaitingForCcpcoj(
            eq(2), eq(true), eq(false), eq(false), eq(true), eq(true), eq(true), eq(true),
            any(LocalDateTime.class)))
            .thenReturn(List.of(cpp));

        assertEquals("1\n", service.pending(2, "0,1,3,6", "session"));
    }

    @Test
    void acceptedResultIsMappedToQojCallback() {
        Submission submission = new Submission();
        submission.id = 8L;
        submission.userId = 2L;
        submission.problemId = 3L;
        submission.contestId = 4L;
        submission.status = "RUNNING";
        submission.judgeServer = "CCPCOJ";
        submission.judgeWorkerId = "worker";

        Submission completed = new Submission();
        completed.id = 8L;
        completed.userId = 2L;
        completed.problemId = 3L;
        completed.contestId = 4L;
        completed.status = "AC";
        completed.judgeServer = "CCPCOJ";
        when(submissionMapper.selectByIdForUpdate(8L)).thenReturn(submission);
        when(submissionMapper.selectById(8L)).thenReturn(completed);

        service.updateSolution(8L, 4, 123, 456, 1.0, "worker");

        ArgumentCaptor<JudgeResultCallbackRequest> request = ArgumentCaptor.forClass(JudgeResultCallbackRequest.class);
        verify(callbackService).handleJudgeResult(request.capture());
        assertEquals("AC", request.getValue().status);
        assertEquals(100, request.getValue().score);
        verify(messagePublisher).submissionChanged(8L, "AC", null, null);
    }

    @Test
    void oiWorkerUsesDedicatedContestQueue() {
        JudgeSettingsVO settings = new JudgeSettingsVO();
        settings.enabled = true;
        settings.mode = "ccpcoj";
        settings.contestMode = "ccpcoj";
        settings.maxConcurrent = 1;
        settings.ccpcojStaleTaskMinutes = 15;
        settings.ccpcojJudgeUsername = "judger";
        when(settingService.getJudgeRuntimeSettings()).thenReturn(settings);
        when(valueOperations.get(any())).thenReturn("judger-oi");
        when(submissionMapper.selectWaitingForCcpcoj(
            eq(1), eq(true), eq(true), eq(true), eq(false), eq(true), eq(false), eq(false),
            any(LocalDateTime.class)))
            .thenReturn(List.of());

        assertEquals("", service.pending(1, "1", "session"));
    }

    @Test
    void staleWorkerCannotOverwriteReclaimedSubmission() {
        Submission submission = new Submission();
        submission.id = 9L;
        submission.status = "RUNNING";
        submission.judgeWorkerId = "new-worker";
        when(submissionMapper.selectByIdForUpdate(9L)).thenReturn(submission);

        service.updateSolution(9L, 5, 20, 30, 0.0, "old-worker");

        verify(submissionMapper).selectByIdForUpdate(9L);
        verifyNoInteractions(callbackService);
    }
}
