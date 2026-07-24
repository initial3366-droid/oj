package com.qoj.module.judge.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.redis.RedisKeys;
import com.qoj.common.util.Utf8TextLimiter;
import com.qoj.module.contest.entity.ContestProblemTestCase;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.mapper.ContestProblemTestCaseMapper;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.service.JudgeCallbackService;
import com.qoj.module.ws.JudgeMessagePublisher;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Ccpcoj判题GatewayService测试类。验证关键业务规则、异常边界及回归场景。
 */
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
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JudgeCallbackService callbackService;
    @Mock private JudgeMessagePublisher messagePublisher;

    private CcpcojJudgeGatewayService service;

    /**
     * 封装setUp相关逻辑。从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态；可能调用外部判题或网关服务。
     */
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
            passwordEncoder,
            callbackService,
            messagePublisher
        );
    }

    /**
     * 封装登录CreatesRateLimited会话AfterConstantCostCredentialCheck相关逻辑。读写 Redis 中的缓存、锁或限流状态；可能调用外部判题或网关服务。
     */
    @Test
    void loginCreatesRateLimitedSessionAfterConstantCostCredentialCheck() {
        JudgeSettingsVO settings = judgeSettings();
        when(valueOperations.increment(anyString())).thenReturn(1L);
        when(settingService.getJudgeRuntimeSettings()).thenReturn(settings);
        when(passwordEncoder.matches("strong-password", settings.ccpcojJudgePassword)).thenReturn(true);

        CcpcojJudgeGatewayService.LoginResult result =
            service.login("judger", "strong-password", "10.0.0.8");

        assertEquals(CcpcojJudgeGatewayService.LoginStatus.SUCCESS, result.status());
        /**
         * 校验前置条件。可能调用外部判题或网关服务。
         */
        verify(passwordEncoder).matches("strong-password", settings.ccpcojJudgePassword);
        /**
         * 校验前置条件。读写 Redis 中的缓存、锁或限流状态。
         */
        verify(redisTemplate, times(2)).expire(anyString(), eq(Duration.ofMinutes(1)));
        ArgumentCaptor<String> sessionValue = ArgumentCaptor.forClass(String.class);
        /**
         * 校验前置条件。可能调用外部判题或网关服务。
         */
        verify(valueOperations).set(
            eq(RedisKeys.ccpcojJudgeSession(result.sessionId())),
            sessionValue.capture(),
            eq(Duration.ofMinutes(720))
        );
        assertEquals(sessionValue("judger", settings), sessionValue.getValue());
    }

    /**
     * 封装unknownUsernameStillRunsPasswordVerification相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void unknownUsernameStillRunsPasswordVerification() {
        JudgeSettingsVO settings = judgeSettings();
        when(valueOperations.increment(anyString())).thenReturn(1L);
        when(settingService.getJudgeRuntimeSettings()).thenReturn(settings);
        when(passwordEncoder.matches("strong-password", settings.ccpcojJudgePassword)).thenReturn(true);

        CcpcojJudgeGatewayService.LoginResult result =
            service.login("unknown", "strong-password", "10.0.0.8");

        assertEquals(CcpcojJudgeGatewayService.LoginStatus.INVALID_CREDENTIALS, result.status());
        /**
         * 校验前置条件。可能调用外部判题或网关服务。
         */
        verify(passwordEncoder).matches("strong-password", settings.ccpcojJudgePassword);
    }

    /**
     * 封装登录StopsBeforeCredentialLookupWhenRateWindowIsExceeded相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void loginStopsBeforeCredentialLookupWhenRateWindowIsExceeded() {
        when(valueOperations.increment(anyString())).thenReturn(6L);

        CcpcojJudgeGatewayService.LoginResult result =
            service.login("judger", "strong-password", "10.0.0.8");

        assertEquals(CcpcojJudgeGatewayService.LoginStatus.RATE_LIMITED, result.status());
        verifyNoInteractions(settingService, passwordEncoder);
    }

    /**
     * 封装rotatingUsernamesCannotBypassThePerIp登录Limit相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void rotatingUsernamesCannotBypassThePerIpLoginLimit() {
        JudgeSettingsVO settings = judgeSettings();
        AtomicInteger ipAttempts = new AtomicInteger();
        when(valueOperations.increment(startsWith("oj:ccpcoj:judge:login-ip-rate:")))
            .thenAnswer(ignored -> (long) ipAttempts.incrementAndGet());
        when(valueOperations.increment(startsWith("oj:ccpcoj:judge:login-rate:"))).thenReturn(1L);
        when(settingService.getJudgeRuntimeSettings()).thenReturn(settings);

        for (int index = 0; index < 10; index++) {
            assertEquals(
                CcpcojJudgeGatewayService.LoginStatus.INVALID_CREDENTIALS,
                service.login("random-worker-" + index, "strong-password", "10.0.0.8").status()
            );
        }

        assertEquals(
            CcpcojJudgeGatewayService.LoginStatus.RATE_LIMITED,
            service.login("random-worker-10", "strong-password", "10.0.0.8").status()
        );
        /**
         * 校验前置条件。可能调用外部判题或网关服务。
         */
        verify(passwordEncoder, times(10)).matches("strong-password", settings.ccpcojJudgePassword);
    }

    /**
     * 封装source编码RequiresTheCurrentWorkerClaim相关逻辑。从持久化层读取数据；可能调用外部判题或网关服务。
     */
    @Test
    void sourceCodeRequiresTheCurrentWorkerClaim() {
        String sessionId = "12345678-abcd-4abc-8abc-1234567890ab";
        JudgeSettingsVO settings = judgeSettings();
        mockAuthenticatedSession(sessionId, "judger", settings);

        Submission submission = new Submission();
        submission.id = 9L;
        submission.code = "int main() {}";
        submission.status = "RUNNING";
        submission.judgeServer = "CCPCOJ";
        submission.judgeBackend = "CCPCOJ";
        submission.judgeWorkerId = "judger-12345678";
        when(submissionMapper.selectById(9L)).thenReturn(submission);

        assertEquals("int main() {}\n", service.sourceCode(9L, sessionId));

        submission.judgeWorkerId = "another-worker";
        assertEquals("", service.sourceCode(9L, sessionId));
    }

    @Test
    void csharpSubmissionUsesCcpcojLanguageIdNine() {
        String sessionId = "12345678-abcd-4abc-8abc-1234567890ab";
        JudgeSettingsVO settings = judgeSettings();
        mockAuthenticatedSession(sessionId, "judger", settings);

        Submission submission = new Submission();
        submission.id = 9L;
        submission.userId = 4L;
        submission.problemId = 1L;
        submission.contestId = 2L;
        submission.language = "csharp";
        submission.status = "RUNNING";
        submission.judgeServer = "CCPCOJ";
        submission.judgeBackend = "CCPCOJ";
        submission.judgeWorkerId = "judger-12345678";
        when(submissionMapper.selectById(9L)).thenReturn(submission);

        assertEquals("2\n4\n9\n2\n", service.solutionInfo(9L, sessionId));
    }

    /**
     * 封装testDataRequiresAn有效ClaimAndLoadsOnlyHiddenCases相关逻辑。从持久化层读取数据；可能调用外部判题或网关服务。
     */
    @Test
    @SuppressWarnings("unchecked")
    void testDataRequiresAnActiveClaimAndLoadsOnlyHiddenCases() {
        String sessionId = "12345678-abcd-4abc-8abc-1234567890ab";
        JudgeSettingsVO settings = judgeSettings();
        mockAuthenticatedSession(sessionId, "judger", settings);
        when(submissionMapper.countActiveCcpcojClaims("judger-12345678", 1L, false)).thenReturn(1L);

        ProblemTestCase hidden = new ProblemTestCase();
        hidden.caseNo = 1;
        hidden.inputData = "1 2";
        hidden.outputData = "3";
        hidden.sample = false;
        when(problemTestCaseMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(hidden));

        assertArrayEquals("1 2".getBytes(StandardCharsets.UTF_8), service.testData("2/1.in", sessionId));

        ArgumentCaptor<QueryWrapper<ProblemTestCase>> queryCaptor = ArgumentCaptor.forClass(QueryWrapper.class);
        /**
         * 校验前置条件。从持久化层读取数据。
         */
        verify(problemTestCaseMapper).selectList(queryCaptor.capture());
        assertTrue(queryCaptor.getValue().getSqlSegment().toLowerCase().contains("sample"));
    }

    /**
     * 封装unclaimed题目DoesNotExposeHiddenData相关逻辑。从持久化层读取数据；可能调用外部判题或网关服务。
     */
    @Test
    void unclaimedProblemDoesNotExposeHiddenData() {
        String sessionId = "12345678-abcd-4abc-8abc-1234567890ab";
        JudgeSettingsVO settings = judgeSettings();
        mockAuthenticatedSession(sessionId, "judger", settings);
        when(submissionMapper.countActiveCcpcojClaims("judger-12345678", 1L, false)).thenReturn(0L);

        assertEquals("", service.testDataList(2L, sessionId));
        /**
         * 校验前置条件。从持久化层读取数据。
         */
        verify(problemTestCaseMapper, never()).selectList(any());
        /**
         * 校验NoInteractions。从持久化层读取数据。
         */
        verifyNoInteractions(contestProblemTestCaseMapper);
    }

    /**
     * 封装go判题SnapshotCannotExposeSourceThroughForgedWorkerOwnership相关逻辑。从持久化层读取数据；可能调用外部判题或网关服务。
     */
    @Test
    void goJudgeSnapshotCannotExposeSourceThroughForgedWorkerOwnership() {
        String sessionId = "12345678-abcd-4abc-8abc-1234567890ab";
        JudgeSettingsVO settings = judgeSettings();
        mockAuthenticatedSession(sessionId, "judger", settings);

        Submission submission = new Submission();
        submission.id = 9L;
        submission.code = "secret source";
        submission.status = "RUNNING";
        submission.judgeServer = "CCPCOJ";
        submission.judgeBackend = "GO_JUDGE";
        submission.judgeWorkerId = "judger-12345678";
        when(submissionMapper.selectById(9L)).thenReturn(submission);

        assertEquals("", service.sourceCode(9L, sessionId));
    }

    /**
     * 封装staleWorkerCannotOverwriteReclaimed提交相关逻辑。执行持久化写入；可能调用外部判题或网关服务。
     */
    @Test
    void staleWorkerCannotOverwriteReclaimedSubmission() {
        Submission submission = new Submission();
        submission.id = 9L;
        submission.status = "RUNNING";
        submission.judgeServer = "CCPCOJ";
        submission.judgeBackend = "CCPCOJ";
        submission.judgeWorkerId = "new-worker";
        when(submissionMapper.selectByIdForUpdate(9L)).thenReturn(submission);

        service.updateSolution(9L, 5, 20, 30, 0.0, "old-worker");

        /**
         * 校验前置条件。从持久化层读取数据。
         */
        verify(submissionMapper).selectByIdForUpdate(9L);
        verifyNoInteractions(callbackService);
    }

    /**
     * 封装判题消息FitsMysqlTextByUtf8Bytes相关逻辑。执行持久化写入；可能调用外部判题或网关服务。
     */
    @Test
    void judgeMessageFitsMysqlTextByUtf8Bytes() {
        Submission submission = new Submission();
        submission.id = 9L;
        submission.status = "RUNNING";
        submission.judgeServer = "CCPCOJ";
        submission.judgeBackend = "CCPCOJ";
        submission.judgeWorkerId = "worker-1";
        when(submissionMapper.selectByIdForUpdate(9L)).thenReturn(submission);

        service.addJudgeMessage(9L, "判".repeat(32000), "worker-1");

        ArgumentCaptor<Submission> saved = ArgumentCaptor.forClass(Submission.class);
        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(submissionMapper).updateById(saved.capture());
        String persisted = saved.getValue().judgeMessage;
        assertTrue(persisted.getBytes(StandardCharsets.UTF_8).length
            <= Utf8TextLimiter.MYSQL_TEXT_SAFE_BYTES);
        assertTrue(persisted.endsWith("\n... (truncated)"));
        assertFalse(persisted.contains("\uFFFD"));
    }

    /**
     * 封装disabled判题RejectsDirectCheckout相关逻辑。从持久化层读取数据；可能调用外部判题或网关服务。
     */
    @Test
    void disabledJudgeRejectsDirectCheckout() {
        String sessionId = "12345678-abcd-4abc-8abc-1234567890ab";
        JudgeSettingsVO settings = judgeSettings();
        settings.enabled = false;
        mockAuthenticatedSession(sessionId, "judger", settings);

        assertFalse(service.checkout(9L, sessionId));

        /**
         * 校验前置条件。从持久化层读取数据；可能调用外部判题或网关服务。
         */
        verify(submissionMapper, never()).claimForCcpcoj(
            any(), anyString(), any(), any(), anyBoolean());
    }

    /**
     * 封装malformed会话CookieIsRejectedBeforeRedisLookup相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void malformedSessionCookieIsRejectedBeforeRedisLookup() {
        assertFalse(service.authenticated("../../oversized-or-forged-session"));
        verify(valueOperations, never()).get(anyString());
        verifyNoInteractions(settingService);
    }

    /**
     * 封装unknownWellFormed会话IsRejectedBeforeDatabaseSettingsLookup相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void unknownWellFormedSessionIsRejectedBeforeDatabaseSettingsLookup() {
        String sessionId = "12345678-abcd-4abc-8abc-1234567890ab";

        assertFalse(service.authenticated(sessionId));

        /**
         * 校验前置条件。可能调用外部判题或网关服务。
         */
        verify(valueOperations).get(RedisKeys.ccpcojJudgeSession(sessionId));
        verifyNoInteractions(settingService);
    }

    /**
     * 封装passwordRotationImmediatelyInvalidatesExistingWorker会话相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void passwordRotationImmediatelyInvalidatesExistingWorkerSession() {
        String sessionId = "12345678-abcd-4abc-8abc-1234567890ab";
        JudgeSettingsVO settings = judgeSettings();
        when(valueOperations.get(RedisKeys.ccpcojJudgeSession(sessionId)))
            .thenReturn(sessionValue("judger", settings));
        when(settingService.getJudgeRuntimeSettings()).thenReturn(settings);

        assertTrue(service.authenticated(sessionId));

        settings.ccpcojJudgePassword = "$2b$12$rotated-hash";
        assertFalse(service.authenticated(sessionId));
    }

    /**
     * 封装mockAuthenticated会话相关逻辑。可能调用外部判题或网关服务。
     */
    private void mockAuthenticatedSession(String sessionId, String username, JudgeSettingsVO settings) {
        when(valueOperations.get(RedisKeys.ccpcojJudgeSession(sessionId)))
            .thenReturn(sessionValue(username, settings));
        when(settingService.getJudgeRuntimeSettings()).thenReturn(settings);
    }

    /**
     * 封装会话值相关逻辑。可能调用外部判题或网关服务。
     */
    private String sessionValue(String username, JudgeSettingsVO settings) {
        String state = settings.ccpcojJudgeUsername + "\n" + settings.ccpcojJudgePassword;
        return username + "\n" + HexFormat.of().formatHex(sha256(state));
    }

    /**
     * 封装sha256相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException ex) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException(ex);
        }
    }

    /**
     * 封装判题Settings相关逻辑。直接返回当前实例保存的settings，不产生额外的数据写入。
     */
    private JudgeSettingsVO judgeSettings() {
        JudgeSettingsVO settings = new JudgeSettingsVO();
        settings.enabled = true;
        settings.mode = "go-judge";
        settings.contestMode = "per-contest";
        settings.maxConcurrent = 2;
        settings.ccpcojJudgeUsername = "judger";
        settings.ccpcojJudgePassword = "$2b$12$configured-hash";
        settings.ccpcojSessionTtlMinutes = 720;
        settings.ccpcojStaleTaskMinutes = 15;
        return settings;
    }
}
