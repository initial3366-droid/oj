package com.qoj.security.policy;

import com.qoj.module.practice.entity.Practice;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("PracticeAccessPolicy Tests")
class PracticeAccessPolicyTest {

    private PracticeAccessPolicy policy;

    @BeforeEach
    void setUp() {
        AuditLogger auditLogger = new AuditLogger();
        policy = new PracticeAccessPolicy(auditLogger);
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

    private AuthUser createClubAdmin() {
        User user = new User();
        user.id = 3L;
        user.username = "clubadmin";
        user.role = "CLUB_ADMIN";
        user.displayName = "Club Admin";
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

    private Practice createPublishedPublicPractice(Long ownerId) {
        Practice practice = new Practice();
        practice.id = 1L;
        practice.title = "Published Public Practice";
        practice.ownerId = ownerId;
        practice.audience = "ALL";
        practice.published = true;
        return practice;
    }

    private Practice createPublishedPrivatePractice(Long ownerId) {
        Practice practice = new Practice();
        practice.id = 2L;
        practice.title = "Published Private Practice";
        practice.ownerId = ownerId;
        practice.audience = "CLUB";
        practice.audienceId = 1L;
        practice.published = true;
        return practice;
    }

    private Practice createUnpublishedPractice(Long ownerId) {
        Practice practice = new Practice();
        practice.id = 3L;
        practice.title = "Unpublished Practice";
        practice.ownerId = ownerId;
        practice.audience = "ALL";
        practice.published = false;
        return practice;
    }

    // VIEW Permission Tests

    @Test
    @DisplayName("VIEW: null practice should deny")
    void testView_NullPractice_ShouldDeny() {
        AuthUser user = createStudent();
        assertFalse(policy.can(user, Permission.VIEW, null));
    }

    @Test
    @DisplayName("VIEW: unpublished practice with null user should deny")
    void testView_UnpublishedPractice_NullUser_ShouldDeny() {
        Practice practice = createUnpublishedPractice(2L);
        assertFalse(policy.can(null, Permission.VIEW, practice));
    }

    @Test
    @DisplayName("VIEW: unpublished practice with owner should allow")
    void testView_UnpublishedPractice_Owner_ShouldAllow() {
        Practice practice = createUnpublishedPractice(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.VIEW, practice));
    }

    @Test
    @DisplayName("VIEW: unpublished practice with super admin should allow")
    void testView_UnpublishedPractice_SuperAdmin_ShouldAllow() {
        Practice practice = createUnpublishedPractice(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.VIEW, practice));
    }

    @Test
    @DisplayName("VIEW: unpublished practice with other user should deny")
    void testView_UnpublishedPractice_OtherUser_ShouldDeny() {
        Practice practice = createUnpublishedPractice(2L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.VIEW, practice));
    }

    @Test
    @DisplayName("VIEW: published public practice with null user should allow")
    void testView_PublishedPublicPractice_NullUser_ShouldAllow() {
        Practice practice = createPublishedPublicPractice(2L);
        assertTrue(policy.can(null, Permission.VIEW, practice));
    }

    @Test
    @DisplayName("VIEW: published public practice with any user should allow")
    void testView_PublishedPublicPractice_AnyUser_ShouldAllow() {
        Practice practice = createPublishedPublicPractice(2L);
        AuthUser student = createStudent();
        assertTrue(policy.can(student, Permission.VIEW, practice));
    }

    @Test
    @DisplayName("VIEW: published private practice with owner should allow")
    void testView_PublishedPrivatePractice_Owner_ShouldAllow() {
        Practice practice = createPublishedPrivatePractice(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.VIEW, practice));
    }

    @Test
    @DisplayName("VIEW: published private practice with super admin should allow")
    void testView_PublishedPrivatePractice_SuperAdmin_ShouldAllow() {
        Practice practice = createPublishedPrivatePractice(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.VIEW, practice));
    }

    @Test
    @DisplayName("VIEW: published private practice with non-member should deny")
    void testView_PublishedPrivatePractice_NonMember_ShouldDeny() {
        Practice practice = createPublishedPrivatePractice(2L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.VIEW, practice));
    }

    // CREATE Permission Tests

    @Test
    @DisplayName("CREATE: null user should deny")
    void testCreate_NullUser_ShouldDeny() {
        Practice practice = createPublishedPublicPractice(1L);
        assertFalse(policy.can(null, Permission.CREATE, practice));
    }

    @Test
    @DisplayName("CREATE: super admin should allow")
    void testCreate_SuperAdmin_ShouldAllow() {
        Practice practice = createPublishedPublicPractice(1L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.CREATE, practice));
    }

    @Test
    @DisplayName("CREATE: removed teacher role should deny")
    void testCreate_RemovedTeacherRole_ShouldDeny() {
        Practice practice = createPublishedPublicPractice(1L);
        AuthUser teacher = createTeacher();
        assertFalse(policy.can(teacher, Permission.CREATE, practice));
    }

    @Test
    @DisplayName("CREATE: club admin should allow")
    void testCreate_ClubAdmin_ShouldAllow() {
        Practice practice = createPublishedPublicPractice(1L);
        AuthUser clubAdmin = createClubAdmin();
        assertTrue(policy.can(clubAdmin, Permission.CREATE, practice));
    }

    @Test
    @DisplayName("CREATE: student should deny")
    void testCreate_Student_ShouldDeny() {
        Practice practice = createPublishedPublicPractice(1L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.CREATE, practice));
    }

    // UPDATE Permission Tests

    @Test
    @DisplayName("UPDATE: null user should deny")
    void testUpdate_NullUser_ShouldDeny() {
        Practice practice = createPublishedPublicPractice(1L);
        assertFalse(policy.can(null, Permission.UPDATE, practice));
    }

    @Test
    @DisplayName("UPDATE: super admin should allow")
    void testUpdate_SuperAdmin_ShouldAllow() {
        Practice practice = createPublishedPublicPractice(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.UPDATE, practice));
    }

    @Test
    @DisplayName("UPDATE: owner should allow")
    void testUpdate_Owner_ShouldAllow() {
        Practice practice = createPublishedPublicPractice(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.UPDATE, practice));
    }

    @Test
    @DisplayName("UPDATE: other user should deny")
    void testUpdate_OtherUser_ShouldDeny() {
        Practice practice = createPublishedPublicPractice(2L);
        AuthUser other = createStudent();
        assertFalse(policy.can(other, Permission.UPDATE, practice));
    }

    // DELETE Permission Tests

    @Test
    @DisplayName("DELETE: null user should deny")
    void testDelete_NullUser_ShouldDeny() {
        Practice practice = createPublishedPublicPractice(1L);
        assertFalse(policy.can(null, Permission.DELETE, practice));
    }

    @Test
    @DisplayName("DELETE: super admin should allow")
    void testDelete_SuperAdmin_ShouldAllow() {
        Practice practice = createPublishedPublicPractice(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.DELETE, practice));
    }

    @Test
    @DisplayName("DELETE: owner should allow")
    void testDelete_Owner_ShouldAllow() {
        Practice practice = createPublishedPublicPractice(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.DELETE, practice));
    }

    @Test
    @DisplayName("DELETE: other user should deny")
    void testDelete_OtherUser_ShouldDeny() {
        Practice practice = createPublishedPublicPractice(2L);
        AuthUser other = createStudent();
        assertFalse(policy.can(other, Permission.DELETE, practice));
    }

    // SUBMIT Permission Tests

    @Test
    @DisplayName("SUBMIT: null user should deny")
    void testSubmit_NullUser_ShouldDeny() {
        Practice practice = createPublishedPublicPractice(1L);
        assertFalse(policy.can(null, Permission.SUBMIT, practice));
    }

    @Test
    @DisplayName("SUBMIT: admin account should deny")
    void testSubmit_AdminAccount_ShouldDeny() {
        Practice practice = createPublishedPublicPractice(2L);
        AuthUser adminAccount = createAdminAccount();
        assertFalse(policy.can(adminAccount, Permission.SUBMIT, practice));
    }

    @Test
    @DisplayName("SUBMIT: unpublished practice should deny")
    void testSubmit_UnpublishedPractice_ShouldDeny() {
        Practice practice = createUnpublishedPractice(2L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.SUBMIT, practice));
    }

    @Test
    @DisplayName("SUBMIT: published public practice with regular user should allow")
    void testSubmit_PublishedPublicPractice_RegularUser_ShouldAllow() {
        Practice practice = createPublishedPublicPractice(2L);
        AuthUser student = createStudent();
        assertTrue(policy.can(student, Permission.SUBMIT, practice));
    }

    @Test
    @DisplayName("SUBMIT: published private practice with non-member should deny")
    void testSubmit_PublishedPrivatePractice_NonMember_ShouldDeny() {
        Practice practice = createPublishedPrivatePractice(2L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.SUBMIT, practice));
    }

    @Test
    @DisplayName("SUBMIT: published public practice with owner should allow")
    void testSubmit_PublishedPublicPractice_Owner_ShouldAllow() {
        Practice practice = createPublishedPublicPractice(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.SUBMIT, practice));
    }

    // Unsupported Permission Tests

    @Test
    @DisplayName("Unsupported permission should deny")
    void testUnsupportedPermission_ShouldDeny() {
        Practice practice = createPublishedPublicPractice(1L);
        AuthUser admin = createSuperAdmin();
        assertFalse(policy.can(admin, Permission.VIEW_CODE, practice));
        assertFalse(policy.can(admin, Permission.VIEW_HIDDEN_CASE, practice));
        assertFalse(policy.can(admin, Permission.REJUDGE, practice));
    }
}
