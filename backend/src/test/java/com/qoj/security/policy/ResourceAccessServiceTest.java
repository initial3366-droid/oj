package com.qoj.security.policy;

import com.qoj.module.practice.entity.Practice;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemFolder;
import com.qoj.module.problem.entity.ProblemFolderItem;
import com.qoj.module.problem.mapper.ProblemFolderMapper;
import com.qoj.module.problem.mapper.ProblemFolderItemMapper;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.security.AuthUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class ResourceAccessServiceTest {
    @Mock private TeacherMapper teacherMapper;
    @Mock private MajorMapper majorMapper;
    @Mock private ProblemFolderMapper folderMapper;
    @Mock private ProblemFolderItemMapper folderItemMapper;
    private ResourceAccessService service;

    @BeforeEach
    void setUp() {
        service = new ResourceAccessService(teacherMapper, majorMapper, folderMapper, folderItemMapper);
    }

    @Test
    void allMajorAndPrivateScopesAreSeparated() {
        AuthUser teacher = teacher(10L, 3L);
        when(teacherMapper.selectById(10L)).thenReturn(teacher.teacher());

        assertTrue(service.canAccessScope(teacher, "ALL", null));
        assertTrue(service.canAccessScope(teacher, "MAJOR", 3L));
        assertFalse(service.canAccessScope(teacher, "MAJOR", 4L));
        assertFalse(service.canAccessScope(teacher, "PRIVATE", 3L));
    }

    @Test
    void sameNumericIdFromDifferentAccountTypeIsNotOwner() {
        AuthUser teacher = teacher(7L, 3L);
        AuthUser admin = admin(7L);

        assertTrue(service.isOwner(teacher, "TEACHER", 7L));
        assertFalse(service.isOwner(admin, "TEACHER", 7L));
    }

    @Test
    void sharedPracticeIsReadableButOwnershipRemainsUnchanged() {
        Practice practice = new Practice();
        practice.ownerId = 20L;
        practice.ownerAccountType = "TEACHER";
        practice.accessScope = "MAJOR";
        practice.majorId = 3L;
        AuthUser teacher = teacher(10L, 3L);
        when(teacherMapper.selectById(10L)).thenReturn(teacher.teacher());

        assertTrue(service.canAccessPractice(teacher, practice));
        assertFalse(service.isOwner(teacher, practice.ownerAccountType, practice.ownerId));
    }

    @Test
    void superAdminCanAccessPrivateFolder() {
        ProblemFolder folder = new ProblemFolder();
        folder.accessScope = "PRIVATE";
        folder.ownerAccountType = "TEACHER";
        folder.ownerId = 9L;
        assertTrue(service.canAccessFolder(superAdmin(1L), folder));
    }

    @Test
    void grantFolderAllowsUseButReferenceFolderDoesNotExpandAccess() {
        AuthUser teacher = teacher(10L, 3L);
        Problem privateProblem = new Problem();
        privateProblem.id = 99L;
        privateProblem.ownerAccountType = "TEACHER";
        privateProblem.ownerId = 20L;
        privateProblem.accessScope = "PRIVATE";

        ProblemFolder sharedFolder = new ProblemFolder();
        sharedFolder.id = 5L;
        sharedFolder.ownerAccountType = "TEACHER";
        sharedFolder.ownerId = 20L;
        sharedFolder.accessScope = "ALL";

        ProblemFolderItem grant = new ProblemFolderItem();
        grant.folderId = 5L;
        grant.problemId = 99L;
        grant.relationType = "GRANT";
        when(folderItemMapper.selectList(any())).thenReturn(List.of(grant), List.of());
        when(folderMapper.selectById(5L)).thenReturn(sharedFolder);

        assertTrue(service.canUseProblem(teacher, privateProblem));

        assertFalse(service.canUseProblem(teacher, privateProblem));
    }

    private AuthUser teacher(Long id, Long majorId) {
        Teacher teacher = new Teacher();
        teacher.id = id;
        teacher.username = "teacher" + id;
        teacher.passwordHash = "hash";
        teacher.displayName = "Teacher " + id;
        teacher.majorId = majorId;
        teacher.status = "ACTIVE";
        return new AuthUser(teacher);
    }

    private AuthUser admin(Long id) {
        AdminUser admin = new AdminUser();
        admin.id = id;
        admin.username = "admin" + id;
        admin.passwordHash = "hash";
        admin.displayName = "Admin " + id;
        admin.role = "SUPER_ADMIN";
        return new AuthUser(admin);
    }

    private AuthUser superAdmin(Long id) {
        AdminUser admin = new AdminUser();
        admin.id = id;
        admin.username = "root" + id;
        admin.passwordHash = "hash";
        admin.displayName = "Root " + id;
        admin.role = "SUPER_ADMIN";
        return new AuthUser(admin);
    }
}
