package com.qoj.security.policy;

import com.qoj.module.user.entity.User;
import com.qoj.security.AuthUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ScoreboardAccessPolicy Tests")
class ScoreboardAccessPolicyTest {

    private ScoreboardAccessPolicy policy;

    @BeforeEach
    void setUp() {
        policy = new ScoreboardAccessPolicy();
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

    private AuthUser createTeacher(Long userId) {
        User user = new User();
        user.id = userId;
        user.username = "teacher" + userId;
        user.role = "TEACHER";
        user.displayName = "Teacher " + userId;
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

    private AuthUser createUser(Long userId, String role) {
        User user = new User();
        user.id = userId;
        user.username = "user" + userId;
        user.role = role;
        user.displayName = "User " + userId;
        user.passwordHash = "hash";
        return new AuthUser(user);
    }

    // canViewGlobalScoreboard Tests

    @Test
    @DisplayName("canViewGlobalScoreboard: null user should allow")
    void testViewGlobalScoreboard_NullUser_ShouldAllow() {
        assertTrue(policy.canViewGlobalScoreboard(null));
    }

    @Test
    @DisplayName("canViewGlobalScoreboard: any authenticated user should allow")
    void testViewGlobalScoreboard_AnyUser_ShouldAllow() {
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.canViewGlobalScoreboard(admin));

        AuthUser teacher = createTeacher(2L);
        assertTrue(policy.canViewGlobalScoreboard(teacher));

        AuthUser student = createStudent();
        assertTrue(policy.canViewGlobalScoreboard(student));
    }

    @Test
    @DisplayName("canViewGlobalScoreboard: everyone can view")
    void testViewGlobalScoreboard_Everyone_ShouldAllow() {
        assertTrue(policy.canViewGlobalScoreboard(null));
        assertTrue(policy.canViewGlobalScoreboard(createSuperAdmin()));
        assertTrue(policy.canViewGlobalScoreboard(createTeacher(2L)));
        assertTrue(policy.canViewGlobalScoreboard(createStudent()));
    }

    // canViewClubScoreboard Tests

    @Test
    @DisplayName("canViewClubScoreboard: null user should deny")
    void testViewClubScoreboard_NullUser_ShouldDeny() {
        assertFalse(policy.canViewClubScoreboard(null, 1L));
    }

    @Test
    @DisplayName("canViewClubScoreboard: super admin can view any club scoreboard")
    void testViewClubScoreboard_SuperAdmin_ShouldAllow() {
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.canViewClubScoreboard(admin, 1L));
        assertTrue(policy.canViewClubScoreboard(admin, 999L));
    }

    @Test
    @DisplayName("canViewClubScoreboard: teacher cannot view by default")
    void testViewClubScoreboard_Teacher_ShouldDeny() {
        AuthUser teacher = createTeacher(2L);
        assertFalse(policy.canViewClubScoreboard(teacher, 1L));
    }

    @Test
    @DisplayName("canViewClubScoreboard: student cannot view by default")
    void testViewClubScoreboard_Student_ShouldDeny() {
        AuthUser student = createStudent();
        assertFalse(policy.canViewClubScoreboard(student, 1L));
    }

    @Test
    @DisplayName("canViewClubScoreboard: club admin cannot view by default")
    void testViewClubScoreboard_ClubAdmin_ShouldDeny() {
        AuthUser clubAdmin = createUser(3L, "CLUB_ADMIN");
        assertFalse(policy.canViewClubScoreboard(clubAdmin, 1L));
    }

    // canViewContestScoreboard Tests

    @Test
    @DisplayName("canViewContestScoreboard: public contest allows null user")
    void testViewContestScoreboard_PublicContest_NullUser_ShouldAllow() {
        assertTrue(policy.canViewContestScoreboard(null, true));
    }

    @Test
    @DisplayName("canViewContestScoreboard: public contest allows any user")
    void testViewContestScoreboard_PublicContest_AnyUser_ShouldAllow() {
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.canViewContestScoreboard(admin, true));

        AuthUser teacher = createTeacher(2L);
        assertTrue(policy.canViewContestScoreboard(teacher, true));

        AuthUser student = createStudent();
        assertTrue(policy.canViewContestScoreboard(student, true));
    }

    @Test
    @DisplayName("canViewContestScoreboard: private contest denies null user")
    void testViewContestScoreboard_PrivateContest_NullUser_ShouldDeny() {
        assertFalse(policy.canViewContestScoreboard(null, false));
    }

    @Test
    @DisplayName("canViewContestScoreboard: private contest allows authenticated user")
    void testViewContestScoreboard_PrivateContest_AuthenticatedUser_ShouldAllow() {
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.canViewContestScoreboard(admin, false));

        AuthUser teacher = createTeacher(2L);
        assertTrue(policy.canViewContestScoreboard(teacher, false));

        AuthUser student = createStudent();
        assertTrue(policy.canViewContestScoreboard(student, false));
    }
}
