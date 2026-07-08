package com.qoj.security.policy;

import com.qoj.module.contest.entity.Contest;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ContestAccessPolicy Tests")
class ContestAccessPolicyTest {

    private ContestAccessPolicy policy;

    @BeforeEach
    void setUp() {
        AuditLogger auditLogger = new AuditLogger();
        policy = new ContestAccessPolicy(auditLogger);
    }

    // Helper methods
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

    private AuthUser createContentAdmin() {
        User user = new User();
        user.id = 3L;
        user.username = "teacher_content";
        user.role = "TEACHER";
        user.displayName = "Teacher Content";
        user.passwordHash = "hash";
        return new AuthUser(user);
    }

    private AuthUser createStudent() {
        User user = new User();
        user.id = 4L;
        user.username = "student";
        user.role = "STUDENT";
        user.displayName = "Student";
        user.passwordHash = "hash";
        return new AuthUser(user);
    }

    private AuthUser createAdminAccount() {
        AdminUser adminUser = new AdminUser();
        adminUser.id = 100L;
        adminUser.username = "backend_admin";
        adminUser.role = "SUPER_ADMIN";
        adminUser.displayName = "Backend Admin";
        adminUser.passwordHash = "hash";
        return new AuthUser(adminUser);
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

    private Contest createPublicContest(Long ownerId) {
        Contest contest = new Contest();
        contest.id = 1L;
        contest.title = "Public Contest";
        contest.ownerId = ownerId;
        contest.ownerAccountType = "USER";
        contest.audience = "ALL";
        contest.startTime = LocalDateTime.now().plusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(3);
        return contest;
    }

    private Contest createPrivateContest(Long ownerId) {
        Contest contest = new Contest();
        contest.id = 2L;
        contest.title = "Private Contest";
        contest.ownerId = ownerId;
        contest.ownerAccountType = "USER";
        contest.audience = "CLASS";
        contest.audienceId = 1L;
        contest.startTime = LocalDateTime.now().plusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(3);
        return contest;
    }

    // VIEW Permission Tests

    @Test
    @DisplayName("VIEW: null contest should deny")
    void testView_NullContest_ShouldDeny() {
        AuthUser user = createStudent();
        assertFalse(policy.can(user, Permission.VIEW, null));
    }

    @Test
    @DisplayName("VIEW: super admin can view any contest")
    void testView_SuperAdmin_ShouldAllow() {
        Contest contest = createPrivateContest(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.VIEW, contest));
    }

    @Test
    @DisplayName("VIEW: owner can view their contest")
    void testView_Owner_ShouldAllow() {
        Contest contest = createPrivateContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.VIEW, contest));
    }

    @Test
    @DisplayName("VIEW: public contest allows anyone")
    void testView_PublicContest_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser student = createStudent();
        assertTrue(policy.can(student, Permission.VIEW, contest));
    }

    @Test
    @DisplayName("VIEW: private contest denies non-member")
    void testView_PrivateContest_NonMember_ShouldDeny() {
        Contest contest = createPrivateContest(2L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.VIEW, contest));
    }

    // canViewProblemDetail Tests

    @Test
    @DisplayName("canViewProblemDetail: before start time, admin can view")
    void testViewProblemDetail_BeforeStart_Admin_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().plusHours(1);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.canViewProblemDetail(admin, contest));
    }

    @Test
    @DisplayName("canViewProblemDetail: before start time, owner can view")
    void testViewProblemDetail_BeforeStart_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().plusHours(1);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.canViewProblemDetail(owner, contest));
    }

    @Test
    @DisplayName("canViewProblemDetail: before start time, regular user cannot view")
    void testViewProblemDetail_BeforeStart_RegularUser_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().plusHours(1);
        AuthUser student = createStudent();
        assertFalse(policy.canViewProblemDetail(student, contest));
    }

    @Test
    @DisplayName("canViewProblemDetail: after start time, can view if has VIEW permission")
    void testViewProblemDetail_AfterStart_ShouldCheckViewPermission() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(1);
        AuthUser student = createStudent();
        assertTrue(policy.canViewProblemDetail(student, contest));
    }

    // CREATE Permission Tests

    @Test
    @DisplayName("CREATE: null user should deny")
    void testCreate_NullUser_ShouldDeny() {
        Contest contest = createPublicContest(1L);
        assertFalse(policy.can(null, Permission.CREATE, contest));
    }

    @Test
    @DisplayName("CREATE: super admin should allow")
    void testCreate_SuperAdmin_ShouldAllow() {
        Contest contest = createPublicContest(1L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.CREATE, contest));
    }

    @Test
    @DisplayName("CREATE: teacher content role should allow")
    void testCreate_TeacherContentRole_ShouldAllow() {
        Contest contest = createPublicContest(1L);
        AuthUser teacher = createTeacher();
        assertTrue(policy.can(teacher, Permission.CREATE, contest));
    }

    @Test
    @DisplayName("CREATE: another teacher content role should allow")
    void testCreate_AnotherTeacherContentRole_ShouldAllow() {
        Contest contest = createPublicContest(1L);
        AuthUser contentAdmin = createContentAdmin();
        assertTrue(policy.can(contentAdmin, Permission.CREATE, contest));
    }

    @Test
    @DisplayName("CREATE: student should deny")
    void testCreate_Student_ShouldDeny() {
        Contest contest = createPublicContest(1L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.CREATE, contest));
    }

    // UPDATE Permission Tests

    @Test
    @DisplayName("UPDATE: null user should deny")
    void testUpdate_NullUser_ShouldDeny() {
        Contest contest = createPublicContest(1L);
        assertFalse(policy.can(null, Permission.UPDATE, contest));
    }

    @Test
    @DisplayName("UPDATE: super admin should allow")
    void testUpdate_SuperAdmin_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.UPDATE, contest));
    }

    @Test
    @DisplayName("UPDATE: owner should allow")
    void testUpdate_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.UPDATE, contest));
    }

    @Test
    @DisplayName("UPDATE: other user should deny")
    void testUpdate_OtherUser_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        AuthUser other = createStudent();
        assertFalse(policy.can(other, Permission.UPDATE, contest));
    }

    // DELETE Permission Tests

    @Test
    @DisplayName("DELETE: null user should deny")
    void testDelete_NullUser_ShouldDeny() {
        Contest contest = createPublicContest(1L);
        assertFalse(policy.can(null, Permission.DELETE, contest));
    }

    @Test
    @DisplayName("DELETE: super admin should allow")
    void testDelete_SuperAdmin_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.DELETE, contest));
    }

    @Test
    @DisplayName("DELETE: owner should allow")
    void testDelete_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.DELETE, contest));
    }

    @Test
    @DisplayName("DELETE: other user should deny")
    void testDelete_OtherUser_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        AuthUser other = createStudent();
        assertFalse(policy.can(other, Permission.DELETE, contest));
    }

    // SUBMIT Permission Tests

    @Test
    @DisplayName("SUBMIT: null user should deny")
    void testSubmit_NullUser_ShouldDeny() {
        Contest contest = createPublicContest(1L);
        assertFalse(policy.can(null, Permission.SUBMIT, contest));
    }

    @Test
    @DisplayName("SUBMIT: before contest start should deny")
    void testSubmit_BeforeStart_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().plusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(3);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.SUBMIT, contest));
    }

    @Test
    @DisplayName("SUBMIT: after contest end should deny")
    void testSubmit_AfterEnd_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(3);
        contest.endTime = LocalDateTime.now().minusHours(1);
        contest.allowAfterEndSubmit = false;
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.SUBMIT, contest));
    }

    @Test
    @DisplayName("SUBMIT: after contest end with allowAfterEndSubmit should allow")
    void testSubmit_AfterEnd_AllowedByConfig_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(3);
        contest.endTime = LocalDateTime.now().minusHours(1);
        contest.allowAfterEndSubmit = true;
        AuthUser student = createStudent();
        assertTrue(policy.can(student, Permission.SUBMIT, contest));
    }

    @Test
    @DisplayName("SUBMIT: super admin should deny")
    void testSubmit_SuperAdmin_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(1);
        AuthUser admin = createSuperAdmin();
        assertFalse(policy.can(admin, Permission.SUBMIT, contest));
    }

    @Test
    @DisplayName("SUBMIT: owner should deny")
    void testSubmit_Owner_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(1);
        AuthUser owner = createUser(2L, "TEACHER");
        assertFalse(policy.can(owner, Permission.SUBMIT, contest));
    }

    @Test
    @DisplayName("SUBMIT: admin account should deny")
    void testSubmit_AdminAccount_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(1);
        AuthUser adminAccount = createAdminAccount();
        assertFalse(policy.can(adminAccount, Permission.SUBMIT, contest));
    }

    @Test
    @DisplayName("SUBMIT: regular user during contest should allow")
    void testSubmit_RegularUserDuringContest_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(1);
        AuthUser student = createStudent();
        assertTrue(policy.can(student, Permission.SUBMIT, contest));
    }

    // canViewScoreboardDuringFreeze Tests

    @Test
    @DisplayName("canViewScoreboardDuringFreeze: null user should deny")
    void testViewScoreboardDuringFreeze_NullUser_ShouldDeny() {
        Contest contest = createPublicContest(1L);
        assertFalse(policy.canViewScoreboardDuringFreeze(null, contest));
    }

    @Test
    @DisplayName("canViewScoreboardDuringFreeze: super admin should allow")
    void testViewScoreboardDuringFreeze_SuperAdmin_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.canViewScoreboardDuringFreeze(admin, contest));
    }

    @Test
    @DisplayName("canViewScoreboardDuringFreeze: owner should allow")
    void testViewScoreboardDuringFreeze_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.canViewScoreboardDuringFreeze(owner, contest));
    }

    @Test
    @DisplayName("canViewScoreboardDuringFreeze: regular user should deny")
    void testViewScoreboardDuringFreeze_RegularUser_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        AuthUser student = createStudent();
        assertFalse(policy.canViewScoreboardDuringFreeze(student, contest));
    }

    // MANAGE_REGISTRATION Permission Tests

    @Test
    @DisplayName("MANAGE_REGISTRATION: super admin should allow")
    void testManageRegistration_SuperAdmin_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.MANAGE_REGISTRATION, contest));
    }

    @Test
    @DisplayName("MANAGE_REGISTRATION: owner should allow")
    void testManageRegistration_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.MANAGE_REGISTRATION, contest));
    }

    @Test
    @DisplayName("MANAGE_REGISTRATION: other user should deny")
    void testManageRegistration_OtherUser_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.MANAGE_REGISTRATION, contest));
    }

    // REJUDGE Permission Tests

    @Test
    @DisplayName("REJUDGE: super admin should allow")
    void testRejudge_SuperAdmin_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.REJUDGE, contest));
    }

    @Test
    @DisplayName("REJUDGE: owner should allow")
    void testRejudge_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.REJUDGE, contest));
    }

    @Test
    @DisplayName("REJUDGE: other user should deny")
    void testRejudge_OtherUser_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.REJUDGE, contest));
    }
}
