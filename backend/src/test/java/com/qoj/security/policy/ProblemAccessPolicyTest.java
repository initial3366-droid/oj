package com.qoj.security.policy;

import com.qoj.module.problem.entity.Problem;
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
class ProblemAccessPolicyTest {
    @Mock private ResourceAccessService resourceAccessService;
    private ProblemAccessPolicy policy;

    @BeforeEach
    void setUp() {
        policy = new ProblemAccessPolicy(new AuditLogger(), resourceAccessService);
    }

    @Test
    void studentCanOnlyViewPublishedProblem() {
        Problem problem = problem(2L);
        AuthUser student = student(3L);
        problem.studentPublishStatus = "DRAFT";
        assertFalse(policy.can(student, Permission.VIEW, problem));

        problem.studentPublishStatus = "PUBLISHED";
        assertTrue(policy.can(student, Permission.VIEW, problem));
    }

    @Test
    void anonymousCannotViewPublishedProblem() {
        Problem problem = problem(2L);
        problem.studentPublishStatus = "PUBLISHED";
        assertFalse(policy.can(null, Permission.VIEW, problem));
    }

    @Test
    void sharedTeacherCanUseButCannotEditProblem() {
        Problem problem = problem(2L);
        AuthUser teacher = teacher(8L);
        when(resourceAccessService.canUseProblem(teacher, problem)).thenReturn(true);

        assertTrue(policy.can(teacher, Permission.VIEW, problem));
        assertFalse(policy.can(teacher, Permission.UPDATE, problem));
        assertFalse(policy.can(teacher, Permission.DELETE, problem));
    }

    @Test
    void teachersCanCreateAndStudentsCannot() {
        assertTrue(policy.can(teacher(2L), Permission.CREATE, problem(2L)));
        assertFalse(policy.can(student(3L), Permission.CREATE, problem(2L)));
    }

    @Test
    void sameNumericIdFromDifferentAccountTypeIsNotOwner() {
        Problem problem = problem(7L);
        AuthUser student = student(7L);
        assertFalse(policy.can(student, Permission.UPDATE, problem));
    }

    private Problem problem(Long ownerId) {
        Problem problem = new Problem();
        problem.id = 1L;
        problem.ownerId = ownerId;
        problem.ownerAccountType = "TEACHER";
        problem.accessScope = "PRIVATE";
        problem.studentPublishStatus = "DRAFT";
        return problem;
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
