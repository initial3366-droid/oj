package com.qoj.module.judge.service;

import com.qoj.common.enums.SubmissionStatus;
import com.qoj.module.contest.mapper.ContestProblemCaseScoreMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
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
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Verifies queue ownership recovery at the executor handoff boundary. */
@ExtendWith(MockitoExtension.class)
class JudgeQueueSchedulerTest {
    /**
     * 封装rejectedDispatchAtomicallyReturnsClaimToOriginal队列State相关逻辑。从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态；可能调用外部判题或网关服务。
     */
    @Mock private SubmissionMapper submissionMapper;
    @Mock private ProblemMapper problemMapper;
    @Mock private ProblemTestCaseMapper problemTestCaseMapper;
    @Mock private ContestProblemMapper contestProblemMapper;
    @Mock private ContestProblemCaseScoreMapper contestProblemCaseScoreMapper;
    @Mock private GoJudgeService goJudgeService;
    @Mock private JudgeCallbackService callbackService;
    @Mock private JudgeMessagePublisher messagePublisher;
    @Mock private ThreadPoolTaskExecutor judgeTaskExecutor;
    @Mock private SystemSettingService settingService;
    @Mock private StringRedisTemplate redisTemplate;

    @Test
    void rejectedDispatchAtomicallyReturnsClaimToOriginalQueueState() {
        JudgeSettingsVO settings = new JudgeSettingsVO();
        settings.enabled = true;
        settings.mode = "go-judge";
        settings.contestMode = "per-contest";
        settings.pollIntervalMs = 1;
        settings.maxConcurrent = 2;
        settings.queueBatchSize = 2;

        Submission submission = new Submission();
        submission.id = 7L;
        submission.status = "WAITING";
        submission.judgeBackend = "GO_JUDGE";

        when(settingService.getJudgeRuntimeSettings()).thenReturn(settings);
        when(submissionMapper.countRunning()).thenReturn(0L);
        when(submissionMapper.selectWaitingForEmbeddedJudge(2))
            .thenReturn(List.of(submission));
        when(submissionMapper.atomicClaim(
            eq(7L), eq("WAITING"), eq("JUDGING"), eq("GO_JUDGE"), anyString(), any(LocalDateTime.class)
        )).thenReturn(1);
        when(judgeTaskExecutor.submit(any(Runnable.class)))
            .thenThrow(new TaskRejectedException("executor is shutting down"));
        when(submissionMapper.restoreRejectedEmbeddedClaim(
            eq(7L), anyString(), eq("WAITING"), any(LocalDateTime.class)
        )).thenReturn(1);

        JudgeQueueScheduler scheduler = new JudgeQueueScheduler(
            submissionMapper,
            problemMapper,
            problemTestCaseMapper,
            contestProblemMapper,
            contestProblemCaseScoreMapper,
            goJudgeService,
            callbackService,
            messagePublisher,
            judgeTaskExecutor,
            settingService,
            redisTemplate
        );

        scheduler.pollAndDispatch();

        /**
         * 校验前置条件。从持久化层读取数据。
         */
        verify(submissionMapper).restoreRejectedEmbeddedClaim(
            eq(7L), anyString(), eq("WAITING"), any(LocalDateTime.class));
        verify(messagePublisher).submissionChanged(7L, "WAITING", null, null);
        verify(messagePublisher).submissionQueueUpdated();
    }

    @Test
    void staleGoJudgeClaimsAreRequeuedBeforePollingNewWork() {
        JudgeSettingsVO settings = new JudgeSettingsVO();
        settings.enabled = true;
        settings.pollIntervalMs = 1;
        settings.maxConcurrent = 2;
        settings.queueBatchSize = 2;
        settings.ccpcojStaleTaskMinutes = 15;

        when(settingService.getJudgeRuntimeSettings()).thenReturn(settings);
        when(submissionMapper.requeueStaleGoJudgeClaims(
            any(LocalDateTime.class), any(LocalDateTime.class))
        ).thenReturn(1);
        when(submissionMapper.countRunning()).thenReturn(0L);
        when(submissionMapper.selectWaitingForEmbeddedJudge(2)).thenReturn(List.of());

        JudgeQueueScheduler scheduler = new JudgeQueueScheduler(
            submissionMapper,
            problemMapper,
            problemTestCaseMapper,
            contestProblemMapper,
            contestProblemCaseScoreMapper,
            goJudgeService,
            callbackService,
            messagePublisher,
            judgeTaskExecutor,
            settingService,
            redisTemplate
        );

        scheduler.pollAndDispatch();

        verify(submissionMapper).requeueStaleGoJudgeClaims(
            any(LocalDateTime.class), any(LocalDateTime.class));
        verify(messagePublisher).submissionQueueUpdated();
    }

    @Test
    void nonContestSubmissionAllCasesPassedScoresFullMarks() {
        runNonContestJudgement(List.of(
            caseResult(1, SubmissionStatus.AC),
            caseResult(2, SubmissionStatus.AC)
        ));

        ArgumentCaptor<JudgeResultCallbackRequest> captor =
            ArgumentCaptor.forClass(JudgeResultCallbackRequest.class);
        verify(callbackService).handleJudgeResult(captor.capture());
        assertEquals(100, captor.getValue().score);
    }

    @Test
    void nonContestSubmissionScoresPassedCaseRatio() {
        runNonContestJudgement(List.of(
            caseResult(1, SubmissionStatus.AC),
            caseResult(2, SubmissionStatus.WA)
        ));

        ArgumentCaptor<JudgeResultCallbackRequest> captor =
            ArgumentCaptor.forClass(JudgeResultCallbackRequest.class);
        verify(callbackService).handleJudgeResult(captor.capture());
        assertEquals(50, captor.getValue().score);
    }

    @Test
    void nonNativeLanguageReceivesDoubleProblemLimits() {
        JudgeTask task = runNonContestJudgement(List.of(
            caseResult(1, SubmissionStatus.AC),
            caseResult(2, SubmissionStatus.AC)
        ), "python");

        assertEquals(2000, task.timeLimit());
        assertEquals(256, task.memoryLimit());
    }

    /**
     * 非比赛提交（contestId 为空）经 go-judge 判题后，分数按通过测试点比例 x 100 计算。
     */
    private JudgeTask runNonContestJudgement(List<JudgeCaseResult> caseResults) {
        return runNonContestJudgement(caseResults, "cpp");
    }

    private JudgeTask runNonContestJudgement(List<JudgeCaseResult> caseResults, String language) {
        JudgeSettingsVO settings = new JudgeSettingsVO();
        settings.enabled = true;
        settings.mode = "go-judge";
        settings.contestMode = "per-contest";
        settings.pollIntervalMs = 1;
        settings.maxConcurrent = 2;
        settings.queueBatchSize = 2;

        Submission submission = new Submission();
        submission.id = 10L;
        submission.userId = 1L;
        submission.problemId = 3L;
        submission.language = language;
        submission.status = "WAITING";
        submission.judgeBackend = "GO_JUDGE";

        Problem problem = new Problem();
        problem.id = 3L;
        problem.timeLimit = 1000;
        problem.memoryLimit = 128;

        ProblemTestCase firstCase = new ProblemTestCase();
        firstCase.caseNo = 1;
        firstCase.inputData = "1";
        firstCase.outputData = "1";
        firstCase.sample = false;
        ProblemTestCase secondCase = new ProblemTestCase();
        secondCase.caseNo = 2;
        secondCase.inputData = "2";
        secondCase.outputData = "2";
        secondCase.sample = false;

        when(settingService.getJudgeRuntimeSettings()).thenReturn(settings);
        when(submissionMapper.countRunning()).thenReturn(0L);
        when(submissionMapper.selectWaitingForEmbeddedJudge(2))
            .thenReturn(List.of(submission));
        when(submissionMapper.atomicClaim(
            eq(10L), eq("WAITING"), eq("JUDGING"), eq("GO_JUDGE"), anyString(), any(LocalDateTime.class)
        )).thenReturn(1);
        doAnswer(invocation -> {
            invocation.getArgument(0, Runnable.class).run();
            return null;
        }).when(judgeTaskExecutor).submit(any(Runnable.class));
        when(problemMapper.selectById(3L)).thenReturn(problem);
        when(problemTestCaseMapper.selectList(any())).thenReturn(List.of(firstCase, secondCase));
        when(goJudgeService.judge(any(JudgeTask.class))).thenReturn(
            new JudgeResult(SubmissionStatus.WA, "", 10, 1024, caseResults));
        when(submissionMapper.selectById(10L)).thenReturn(submission);
        when(submissionMapper.updateGoJudgeCompletionMetadata(
            eq(10L), anyString(), any(), any(), any(LocalDateTime.class))
        ).thenReturn(1);
        when(redisTemplate.delete(anyString())).thenReturn(true);
        when(submissionMapper.countByProblemId(3L)).thenReturn(2L);
        when(submissionMapper.countAcceptedByProblemId(3L)).thenReturn(1L);
        when(problemMapper.updateById(any(Problem.class))).thenReturn(1);

        JudgeQueueScheduler scheduler = new JudgeQueueScheduler(
            submissionMapper,
            problemMapper,
            problemTestCaseMapper,
            contestProblemMapper,
            contestProblemCaseScoreMapper,
            goJudgeService,
            callbackService,
            messagePublisher,
            judgeTaskExecutor,
            settingService,
            redisTemplate
        );

        scheduler.pollAndDispatch();

        ArgumentCaptor<JudgeTask> taskCaptor = ArgumentCaptor.forClass(JudgeTask.class);
        verify(goJudgeService).judge(taskCaptor.capture());
        return taskCaptor.getValue();
    }

    private JudgeCaseResult caseResult(int caseNo, SubmissionStatus status) {
        return new JudgeCaseResult(caseNo, status, 10, 1024, "in", "out", "out", "");
    }
}
