package com.qoj.security.policy;

import com.qoj.module.practice.entity.Practice;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.user.entity.User;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PracticeAccessPolicyTest {
    @Mock private ResourceAccessService resourceAccessService;
    private PracticeAccessPolicy policy;

    @BeforeEach
    void setUp() {
        policy = new PracticeAccessPolicy(new AuditLogger(), resourceAccessService);
    }

    @Test
    void teacherCanCreateButStudentCannot() {
        assertTrue(policy.can(teacher(2L), Permission.CREATE, practice(2L)));
        assertFalse(policy.can(student(2L), Permission.CREATE, practice(2L)));
    }

    @Test
    void sharedPracticeCanBeViewedButNotEdited() {
        Practice practice = practice(10L);
        AuthUser sharedTeacher = teacher(20L);
        when(resourceAccessService.canAccessPractice(sharedTeacher, practice)).thenReturn(true);
        when(resourceAccessService.isOwner(sharedTeacher, "TEACHER", 10L)).thenReturn(false);

        assertTrue(policy.can(sharedTeacher, Permission.VIEW, practice));
        assertFalse(policy.can(sharedTeacher, Permission.UPDATE, practice));
        assertFalse(policy.can(sharedTeacher, Permission.DELETE, practice));
    }

    @Test
    void sameNumericIdFromDifferentAccountTypeIsNotOwner() {
        Practice practice = practice(7L);
        AuthUser student = student(7L);
        when(resourceAccessService.isOwner(student, "TEACHER", 7L)).thenReturn(false);

        assertFalse(policy.can(student, Permission.UPDATE, practice));
    }

    @Test
    void templateCannotBeSubmittedDirectly() {
        assertFalse(policy.can(student(3L), Permission.SUBMIT, practice(2L)));
    }

    private Practice practice(Long ownerId) {
        Practice practice = new Practice();
        practice.id = 1L;
        practice.ownerId = ownerId;
        practice.ownerAccountType = "TEACHER";
        practice.accessScope = "PRIVATE";
        return practice;
    }

    private AuthUser teacher(Long id) {
        Teacher teacher = new Teacher();
        teacher.id = id;
        teacher.username = "teacher" + id;
        teacher.displayName = "Teacher " + id;
        teacher.passwordHash = "hash";
        teacher.status = "ACTIVE";
        return new AuthUser(teacher);
    }

    private AuthUser student(Long id) {
        User user = new User();
        user.id = id;
        user.username = "student" + id;
        user.displayName = "Student " + id;
        user.passwordHash = "hash";
        user.role = "STUDENT";
        return new AuthUser(user);
    }

}
