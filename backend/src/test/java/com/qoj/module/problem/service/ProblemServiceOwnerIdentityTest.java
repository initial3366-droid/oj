package com.qoj.module.problem.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.module.problem.mapper.ProblemFolderMapper;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.mapper.UserProblemStatusMapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.security.policy.ProblemAccessPolicy;
import com.qoj.security.policy.ResourceAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProblemServiceOwnerIdentityTest {
    @Mock private ProblemMapper problemMapper;
    @Mock private ProblemTestCaseMapper problemTestCaseMapper;
    @Mock private SubmissionMapper submissionMapper;
    @Mock private UserProblemStatusMapper userProblemStatusMapper;
    @Mock private UserMapper userMapper;
    @Mock private AdminUserMapper adminUserMapper;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ProblemAccessPolicy problemAccessPolicy;
    @Mock private ProblemFolderMapper problemFolderMapper;
    @Mock private TeacherMapper teacherMapper;
    @Mock private MajorMapper majorMapper;
    @Mock private ResourceAccessService resourceAccessService;
    @Mock private ProblemFolderService problemFolderService;

    private ProblemService problemService;

    @BeforeEach
    void setUp() {
        problemService = new ProblemService(
            problemMapper,
            problemTestCaseMapper,
            submissionMapper,
            userProblemStatusMapper,
            userMapper,
            adminUserMapper,
            new ObjectMapper(),
            redisTemplate,
            problemAccessPolicy,
            problemFolderMapper,
            teacherMapper,
            majorMapper,
            resourceAccessService,
            problemFolderService
        );
    }

    @Test
    void adminOwnerNameDoesNotResolveSameIdStudent() {
        AdminUser admin = new AdminUser();
        admin.id = 3L;
        admin.displayName = "题库管理员";
        when(resourceAccessService.normalizeOwnerType("ADMIN")).thenReturn("ADMIN");
        when(adminUserMapper.selectById(3L)).thenReturn(admin);

        String ownerName = ReflectionTestUtils.invokeMethod(problemService, "ownerName", 3L, "ADMIN");

        assertEquals("题库管理员", ownerName);
        verify(userMapper, never()).selectById(3L);
    }
}
