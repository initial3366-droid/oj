package com.qoj.security.policy;

import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.security.AuthUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 榜单访问Policy访问策略。根据当前身份、资源归属和操作类型统一作出权限判断。
 */
@DisplayName("ScoreboardAccessPolicy Tests")
class ScoreboardAccessPolicyTest {

    private ScoreboardAccessPolicy policy;

    /**
     * 封装setUp相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @BeforeEach
    void setUp() {
        policy = new ScoreboardAccessPolicy();
    }

    // Helper methods
    private AuthUser createSuperAdmin() {
        AdminUser user = new AdminUser();
        user.id = 1L;
        user.username = "admin";
        user.role = "SUPER_ADMIN";
        user.displayName = "Super Admin";
        user.passwordHash = "hash";
        /**
         * 封装认证用户相关逻辑。调用前会结合当前登录身份执行权限判断。
         */
        return new AuthUser(user);
    }

    /**
     * 创建或提交教师。调用前会结合当前登录身份执行权限判断。
     */
    private AuthUser createTeacher(Long userId) {
        Teacher user = new Teacher();
        user.id = userId;
        user.username = "teacher" + userId;
        user.displayName = "Teacher " + userId;
        user.passwordHash = "hash";
        user.status = "ACTIVE";
        /**
         * 封装认证用户相关逻辑。调用前会结合当前登录身份执行权限判断。
         */
        return new AuthUser(user);
    }

    /**
     * 创建或提交Student。调用前会结合当前登录身份执行权限判断。
     */
    private AuthUser createStudent() {
        User user = new User();
        user.id = 4L;
        user.username = "student";
        user.role = "STUDENT";
        user.displayName = "Student";
        user.passwordHash = "hash";
        /**
         * 封装认证用户相关逻辑。调用前会结合当前登录身份执行权限判断。
         */
        return new AuthUser(user);
    }

    // canViewGlobalScoreboard Tests

    @Test
    @DisplayName("canViewGlobalScoreboard: null user should allow")
    void testViewGlobalScoreboard_NullUser_ShouldAllow() {
        assertTrue(policy.canViewGlobalScoreboard(null));
    }

    /**
     * 封装testViewGlobal榜单Any用户ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
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

    /**
     * 封装testViewGlobal榜单EveryoneShouldAllow相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    @DisplayName("canViewGlobalScoreboard: everyone can view")
    void testViewGlobalScoreboard_Everyone_ShouldAllow() {
        assertTrue(policy.canViewGlobalScoreboard(null));
        assertTrue(policy.canViewGlobalScoreboard(createSuperAdmin()));
        assertTrue(policy.canViewGlobalScoreboard(createTeacher(2L)));
        assertTrue(policy.canViewGlobalScoreboard(createStudent()));
    }

    // canViewContestScoreboard Tests

    @Test
    @DisplayName("canViewContestScoreboard: public contest allows null user")
    void testViewContestScoreboard_PublicContest_NullUser_ShouldAllow() {
        assertTrue(policy.canViewContestScoreboard(null, true));
    }

    /**
     * 封装testView比赛榜单Public比赛Any用户ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
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

    /**
     * 封装testView比赛榜单Private比赛Null用户ShouldDeny相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    @DisplayName("canViewContestScoreboard: private contest denies null user")
    void testViewContestScoreboard_PrivateContest_NullUser_ShouldDeny() {
        assertFalse(policy.canViewContestScoreboard(null, false));
    }

    /**
     * 封装testView比赛榜单Private比赛Authenticated用户ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
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
