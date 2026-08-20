package com.qoj.module.problem.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.module.problem.mapper.ProblemFolderMapper;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.mapper.UserProblemStatusMapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.security.policy.ProblemAccessPolicy;
import com.qoj.security.policy.ResourceAccessService;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
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

    @Test
    void hiddenSpjCasesMayOmitTheJuryOutput() {
        assertTrue(ProblemService.requiresExpectedOutput(false, null));
        assertTrue(ProblemService.requiresExpectedOutput(true, "#include \"testlib.h\""));
        assertFalse(ProblemService.requiresExpectedOutput(false, "#include \"testlib.h\""));
    }

    @Test
    @SuppressWarnings("unchecked")
    void spjZipMayOmitOutputFiles() throws IOException {
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "tests.zip",
            "application/zip",
            zipWithEntry("1.in", "")
        );

        List<ProblemTestCase> testCases = ReflectionTestUtils.invokeMethod(
            problemService,
            "parseZipTestCases",
            file,
            true
        );

        assertEquals(1, testCases.size());
        assertEquals("", testCases.get(0).outputData);
    }

    private byte[] zipWithEntry(String name, String content) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry(name));
            zip.write(content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return bytes.toByteArray();
    }
}
