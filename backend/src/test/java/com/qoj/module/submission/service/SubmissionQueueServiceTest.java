package com.qoj.module.submission.service;

import com.qoj.common.exception.BizException;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.ws.JudgeMessagePublisher;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import com.qoj.security.policy.ContestAccessPolicy;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 提交队列Service测试类。验证关键业务规则、异常边界及回归场景。
 */
@ExtendWith(MockitoExtension.class)
class SubmissionQueueServiceTest {
    @Mock private SubmissionMapper submissionMapper;
    @Mock private ContestMapper contestMapper;
    @Mock private ContestProblemMapper contestProblemMapper;
    @Mock private ProblemMapper problemMapper;
    @Mock private UserMapper userMapper;
    @Mock private SubmissionService submissionService;
    @Mock private AuditLogger auditLogger;
    @Mock private JudgeMessagePublisher messagePublisher;
    @Mock private SystemSettingService settingService;
    @Mock private ContestAccessPolicy contestAccessPolicy;

    private SubmissionQueueService service;

    /**
     * 封装setUp相关逻辑。调用前会结合当前登录身份执行权限判断；从持久化层读取数据。
     */
    @BeforeEach
    void setUp() {
        service = new SubmissionQueueService(
            submissionMapper,
            contestMapper,
            contestProblemMapper,
            problemMapper,
            userMapper,
            submissionService,
            auditLogger,
            messagePublisher,
            settingService,
            contestAccessPolicy
        );

        AdminUser admin = new AdminUser();
        admin.id = 1L;
        admin.username = "admin";
        admin.passwordHash = "hash";
        admin.role = "SUPER_ADMIN";
        admin.displayName = "Admin";
        AuthUser principal = new AuthUser(admin);
        SecurityContextHolder.getContext().setAuthentication(
            /**
             * 封装rnamePasswordAuthentication令牌相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
        );
    }

    /**
     * 重置安全Context。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    /**
     * 封装running提交CannotBeRejudged相关逻辑。不满足业务约束时直接抛出明确异常；执行持久化写入。
     */
    @Test
    void runningSubmissionCannotBeRejudged() {
        Submission submission = submission("RUNNING", "GO_JUDGE");
        when(submissionMapper.selectByIdForUpdate(7L)).thenReturn(submission);

        BizException error = assertThrows(BizException.class, () -> service.rejudge(7L));

        assertEquals(409, error.getCode());
        verify(submissionMapper, never()).updateById(org.mockito.ArgumentMatchers.any(Submission.class));
    }

    /**
     * 封装final提交KeepsItsRoutingSnapshotWhenRejudged相关逻辑。执行持久化写入；可能调用外部判题或网关服务。
     */
    @Test
    void finalSubmissionKeepsItsRoutingSnapshotWhenRejudged() {
        Submission submission = submission("AC", "CCPCOJ");
        submission.judgeServer = "CCPCOJ";
        when(submissionMapper.selectByIdForUpdate(7L)).thenReturn(submission);

        service.rejudge(7L);

        ArgumentCaptor<Submission> saved = ArgumentCaptor.forClass(Submission.class);
        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(submissionMapper).updateById(saved.capture());
        assertEquals("REJUDGE_PENDING", saved.getValue().status);
        assertEquals("CCPCOJ", saved.getValue().judgeBackend);
        assertNull(saved.getValue().judgeServer);
    }

    /**
     * 判断celled提交WaitsForOldWorkerBeforeRejudge是否成立。不满足业务约束时直接抛出明确异常；执行持久化写入。
     */
    @Test
    void cancelledSubmissionWaitsForOldWorkerBeforeRejudge() {
        Submission submission = submission("FAILED", "GO_JUDGE");
        submission.judgeWorkerId = "old-go-judge-worker";
        when(submissionMapper.selectByIdForUpdate(7L)).thenReturn(submission);

        BizException error = assertThrows(BizException.class, () -> service.rejudge(7L));

        assertEquals(409, error.getCode());
        verify(submissionMapper, never()).updateById(org.mockito.ArgumentMatchers.any(Submission.class));
    }

    /**
     * 封装提交相关逻辑。直接返回当前实例保存的提交，不产生额外的数据写入。
     */
    private Submission submission(String status, String backend) {
        Submission submission = new Submission();
        submission.id = 7L;
        submission.userId = 2L;
        submission.problemId = 3L;
        submission.language = "cpp";
        submission.status = status;
        submission.judgeBackend = backend;
        submission.priority = 0;
        submission.retryCount = 0;
        return submission;
    }
}
