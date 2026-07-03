package com.qoj.security.policy;

import com.qoj.module.problem.entity.Problem;
import com.qoj.module.user.entity.User;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ProblemAccessPolicy Tests")
class ProblemAccessPolicyTest {

    private ProblemAccessPolicy policy;

    @BeforeEach
    void setUp() {
        AuditLogger auditLogger = new AuditLogger();
        policy = new ProblemAccessPolicy(auditLogger);
    }

    // Helper methods to create test users
    private AuthUser createSuperAdmin() {
        User user = new User();
        user.id = 1L;
        user.username = "admin";
        user.role = "SUPER_ADMIN";
        user.displayName = "Super Admin";
        user.passwordHash = "hash";
        return new AuthUser(user);
    }

    private AuthUser createTeacher() {
        User user = new User();
        user.id = 2L;
        user.username = "teacher";
        user.role = "TEACHER";
        user.displayName = "Teacher";
        user.passwordHash = "hash";
        return new AuthUser(user);
    }

    private AuthUser createStudent() {
        User user = new User();
        user.id = 3L;
        user.username = "student";
        user.role = "STUDENT";
        user.displayName = "Student";
        user.passwordHash = "hash";
        return new AuthUser(user);
    }

    private AuthUser createUser(Long userId, String role) {
        User user = new User();
        user.id = userId;
        user.username = "user" + userId;
        user.role = role;
        user.displayName = "User " + userId;
        user.passwordHash = "hash";
        return new AuthUser(user);
    }

    private Problem createPublicProblem(Long ownerId) {
        Problem problem = new Problem();
        problem.id = 1L;
        problem.title = "Test Problem";
        problem.isPublic = true;
        problem.ownerId = ownerId;
        return problem;
    }

    private Problem createPrivateProblem(Long ownerId) {
        Problem problem = new Problem();
        problem.id = 2L;
        problem.title = "Private Problem";
        problem.isPublic = false;
        problem.ownerId = ownerId;
        return problem;
    }

    // VIEW Permission Tests

    @Test
    @DisplayName("VIEW: null problem should deny")
    void testView_NullProblem_ShouldDeny() {
        AuthUser user = createStudent();
        assertFalse(policy.can(user, Permission.VIEW, null));
    }

    @Test
    @DisplayName("VIEW: public problem with null user should allow")
    void testView_PublicProblem_NullUser_ShouldAllow() {
        Problem problem = createPublicProblem(1L);
        assertTrue(policy.can(null, Permission.VIEW, problem));
    }

    @Test
    @DisplayName("VIEW: public problem with any user should allow")
    void testView_PublicProblem_AnyUser_ShouldAllow() {
        Problem problem = createPublicProblem(1L);
        AuthUser student = createStudent();
        assertTrue(policy.can(student, Permission.VIEW, problem));
    }

    @Test
    @DisplayName("VIEW: private problem with null user should deny")
    void testView_PrivateProblem_NullUser_ShouldDeny() {
        Problem problem = createPrivateProblem(1L);
        assertFalse(policy.can(null, Permission.VIEW, problem));
    }

    @Test
    @DisplayName("VIEW: private problem with super admin should allow")
    void testView_PrivateProblem_SuperAdmin_ShouldAllow() {
        Problem problem = createPrivateProblem(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.VIEW, problem));
    }

    @Test
    @DisplayName("VIEW: private problem with owner should allow")
    void testView_PrivateProblem_Owner_ShouldAllow() {
        Problem problem = createPrivateProblem(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.VIEW, problem));
    }

    @Test
    @DisplayName("VIEW: private problem with other user should deny")
    void testView_PrivateProblem_OtherUser_ShouldDeny() {
        Problem problem = createPrivateProblem(2L);
        AuthUser other = createStudent();
        assertFalse(policy.can(other, Permission.VIEW, problem));
    }

    // CREATE Permission Tests

    @Test
    @DisplayName("CREATE: null user should deny")
    void testCreate_NullUser_ShouldDeny() {
        Problem problem = createPublicProblem(1L);
        assertFalse(policy.can(null, Permission.CREATE, problem));
    }

    @Test
    @DisplayName("CREATE: super admin should allow")
    void testCreate_SuperAdmin_ShouldAllow() {
        Problem problem = createPublicProblem(1L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.CREATE, problem));
    }

    @Test
    @DisplayName("CREATE: removed teacher role should deny")
    void testCreate_RemovedTeacherRole_ShouldDeny() {
        Problem problem = createPublicProblem(1L);
        AuthUser teacher = createTeacher();
        assertFalse(policy.can(teacher, Permission.CREATE, problem));
    }

    @Test
    @DisplayName("CREATE: student should deny")
    void testCreate_Student_ShouldDeny() {
        Problem problem = createPublicProblem(1L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.CREATE, problem));
    }

    @Test
    @DisplayName("CREATE: club admin should allow")
    void testCreate_ClubAdmin_ShouldAllow() {
        Problem problem = createPublicProblem(1L);
        AuthUser clubAdmin = createUser(4L, "CLUB_ADMIN");
        assertTrue(policy.can(clubAdmin, Permission.CREATE, problem));
    }

    // UPDATE Permission Tests

    @Test
    @DisplayName("UPDATE: null user should deny")
    void testUpdate_NullUser_ShouldDeny() {
        Problem problem = createPublicProblem(1L);
        assertFalse(policy.can(null, Permission.UPDATE, problem));
    }

    @Test
    @DisplayName("UPDATE: super admin should allow")
    void testUpdate_SuperAdmin_ShouldAllow() {
        Problem problem = createPublicProblem(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.UPDATE, problem));
    }

    @Test
    @DisplayName("UPDATE: owner should allow")
    void testUpdate_Owner_ShouldAllow() {
        Problem problem = createPublicProblem(2L);
        AuthUser owner = createTeacher();
        owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.UPDATE, problem));
    }

    @Test
    @DisplayName("UPDATE: other user should deny")
    void testUpdate_OtherUser_ShouldDeny() {
        Problem problem = createPublicProblem(2L);
        AuthUser other = createStudent();
        assertFalse(policy.can(other, Permission.UPDATE, problem));
    }

    @Test
    @DisplayName("UPDATE: teacher but not owner should deny")
    void testUpdate_TeacherNotOwner_ShouldDeny() {
        Problem problem = createPublicProblem(2L);
        AuthUser teacher = createTeacher(); // teacher has id=2, but we need different id
        AuthUser otherTeacher = createUser(5L, "TEACHER"); // Create a teacher with different id
        assertFalse(policy.can(otherTeacher, Permission.UPDATE, problem));
    }

    // DELETE Permission Tests

    @Test
    @DisplayName("DELETE: null user should deny")
    void testDelete_NullUser_ShouldDeny() {
        Problem problem = createPublicProblem(1L);
        assertFalse(policy.can(null, Permission.DELETE, problem));
    }

    @Test
    @DisplayName("DELETE: super admin should allow")
    void testDelete_SuperAdmin_ShouldAllow() {
        Problem problem = createPublicProblem(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.DELETE, problem));
    }

    @Test
    @DisplayName("DELETE: owner should allow")
    void testDelete_Owner_ShouldAllow() {
        Problem problem = createPublicProblem(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.DELETE, problem));
    }

    @Test
    @DisplayName("DELETE: other user should deny")
    void testDelete_OtherUser_ShouldDeny() {
        Problem problem = createPublicProblem(2L);
        AuthUser other = createStudent();
        assertFalse(policy.can(other, Permission.DELETE, problem));
    }

    // VIEW_HIDDEN_CASE Permission Tests

    @Test
    @DisplayName("VIEW_HIDDEN_CASE: null user should deny")
    void testViewHiddenCase_NullUser_ShouldDeny() {
        Problem problem = createPublicProblem(1L);
        assertFalse(policy.can(null, Permission.VIEW_HIDDEN_CASE, problem));
    }

    @Test
    @DisplayName("VIEW_HIDDEN_CASE: super admin should allow")
    void testViewHiddenCase_SuperAdmin_ShouldAllow() {
        Problem problem = createPublicProblem(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.VIEW_HIDDEN_CASE, problem));
    }

    @Test
    @DisplayName("VIEW_HIDDEN_CASE: owner should allow")
    void testViewHiddenCase_Owner_ShouldAllow() {
        Problem problem = createPublicProblem(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.VIEW_HIDDEN_CASE, problem));
    }

    @Test
    @DisplayName("VIEW_HIDDEN_CASE: other user should deny")
    void testViewHiddenCase_OtherUser_ShouldDeny() {
        Problem problem = createPublicProblem(2L);
        AuthUser other = createStudent();
        assertFalse(policy.can(other, Permission.VIEW_HIDDEN_CASE, problem));
    }

    // Unsupported Permission Tests

    @Test
    @DisplayName("Unsupported permission should deny")
    void testUnsupportedPermission_ShouldDeny() {
        Problem problem = createPublicProblem(1L);
        AuthUser admin = createSuperAdmin();
        assertFalse(policy.can(admin, Permission.SUBMIT, problem));
        assertFalse(policy.can(admin, Permission.VIEW_CODE, problem));
        assertFalse(policy.can(admin, Permission.REJUDGE, problem));
    }
}
