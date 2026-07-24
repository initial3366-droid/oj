package com.qoj.module.judge.service;

import com.qoj.module.contest.mapper.ContestProblemCaseScoreMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.mapper.ContestProblemTestCaseMapper;
import com.qoj.module.judge.gojudge.GoJudgeService;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.service.JudgeCallbackService;
import com.qoj.module.ws.JudgeMessagePublisher;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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
    @Mock private ContestProblemTestCaseMapper contestProblemTestCaseMapper;
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
            contestProblemTestCaseMapper,
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
}
