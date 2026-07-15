package com.qoj.security.policy;

import com.qoj.module.contest.entity.Contest;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 比赛访问Policy访问策略。根据当前身份、资源归属和操作类型统一作出权限判断。
 */
@DisplayName("ContestAccessPolicy Tests")
class ContestAccessPolicyTest {

    private ContestAccessPolicy policy;

    /**
     * 封装setUp相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @BeforeEach
    void setUp() {
        AuditLogger auditLogger = new AuditLogger();
        policy = new ContestAccessPolicy(auditLogger);
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
    private AuthUser createTeacher() {
        Teacher user = new Teacher();
        user.id = 2L;
        user.username = "teacher";
        user.displayName = "Teacher";
        user.passwordHash = "hash";
        user.status = "ACTIVE";
        /**
         * 封装认证用户相关逻辑。调用前会结合当前登录身份执行权限判断。
         */
        return new AuthUser(user);
    }

    /**
     * 创建或提交Content管理员。调用前会结合当前登录身份执行权限判断。
     */
    private AuthUser createContentAdmin() {
        Teacher user = new Teacher();
        user.id = 3L;
        user.username = "teacher_content";
        user.displayName = "Teacher Content";
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

    /**
     * 创建或提交管理员Account。调用前会结合当前登录身份执行权限判断。
     */
    private AuthUser createAdminAccount() {
        AdminUser adminUser = new AdminUser();
        adminUser.id = 100L;
        adminUser.username = "backend_admin";
        adminUser.role = "SUPER_ADMIN";
        adminUser.displayName = "Backend Admin";
        adminUser.passwordHash = "hash";
        /**
         * 封装认证用户相关逻辑。调用前会结合当前登录身份执行权限判断。
         */
        return new AuthUser(adminUser);
    }

    /**
     * 创建或提交用户。调用前会结合当前登录身份执行权限判断。
     */
    private AuthUser createUser(Long userId, String role) {
        if ("TEACHER".equals(role)) {
            Teacher teacher = new Teacher();
            teacher.id = userId;
            teacher.username = "teacher" + userId;
            teacher.displayName = "Teacher " + userId;
            teacher.passwordHash = "hash";
            teacher.status = "ACTIVE";
            return new AuthUser(teacher);
        }
        User user = new User();
        user.id = userId;
        user.username = "user" + userId;
        user.role = role;
        user.displayName = "User " + userId;
        user.passwordHash = "hash";
        /**
         * 封装认证用户相关逻辑。调用前会结合当前登录身份执行权限判断。
         */
        return new AuthUser(user);
    }

    /**
     * 创建或提交Public比赛。直接返回当前实例保存的比赛，不产生额外的数据写入。
     */
    private Contest createPublicContest(Long ownerId) {
        Contest contest = new Contest();
        contest.id = 1L;
        contest.title = "Public Contest";
        contest.ownerId = ownerId;
        contest.ownerAccountType = "TEACHER";
        contest.audience = "ALL";
        contest.startTime = LocalDateTime.now().plusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(3);
        return contest;
    }

    /**
     * 创建或提交Private比赛。直接返回当前实例保存的比赛，不产生额外的数据写入。
     */
    private Contest createPrivateContest(Long ownerId) {
        Contest contest = new Contest();
        contest.id = 2L;
        contest.title = "Private Contest";
        contest.ownerId = ownerId;
        contest.ownerAccountType = "TEACHER";
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

    /**
     * 封装testViewSuper管理员ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("VIEW: super admin can view any contest")
    void testView_SuperAdmin_ShouldAllow() {
        Contest contest = createPrivateContest(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.VIEW, contest));
    }

    /**
     * 封装testViewOwnerShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("VIEW: owner can view their contest")
    void testView_Owner_ShouldAllow() {
        Contest contest = createPrivateContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.VIEW, contest));
    }

    /**
     * 封装testViewPublic比赛ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("VIEW: public contest allows anyone")
    void testView_PublicContest_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser student = createStudent();
        assertTrue(policy.can(student, Permission.VIEW, contest));
    }

    /**
     * 封装testViewPrivate比赛NonMemberShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
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

    /**
     * 封装testView题目详情BeforeStartOwnerShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断；结果依赖当前时间。
     */
    @Test
    @DisplayName("canViewProblemDetail: before start time, owner can view")
    void testViewProblemDetail_BeforeStart_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().plusHours(1);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.canViewProblemDetail(owner, contest));
    }

    /**
     * 封装testView题目详情BeforeStartRegular用户ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断；结果依赖当前时间。
     */
    @Test
    @DisplayName("canViewProblemDetail: before start time, regular user cannot view")
    void testViewProblemDetail_BeforeStart_RegularUser_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().plusHours(1);
        AuthUser student = createStudent();
        assertFalse(policy.canViewProblemDetail(student, contest));
    }

    /**
     * 封装testView题目详情AfterStartShouldCheckView权限相关逻辑。调用前会结合当前登录身份执行权限判断；结果依赖当前时间。
     */
    @Test
    @DisplayName("canViewProblemDetail: after start time, can view if has VIEW permission")
    void testViewProblemDetail_AfterStart_ShouldCheckViewPermission() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(1);
        AuthUser student = createStudent();
        assertTrue(policy.canViewProblemDetail(student, contest));
    }

    @Test
    @DisplayName("canViewProblemDetail: after end follows enabled setting")
    void testViewProblemDetail_AfterEnd_Enabled_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(2);
        contest.endTime = LocalDateTime.now().minusHours(1);
        contest.allowAfterEndViewProblem = true;

        assertTrue(policy.canViewProblemDetail(createStudent(), contest));
    }

    @Test
    @DisplayName("canViewProblemDetail: after end follows disabled setting")
    void testViewProblemDetail_AfterEnd_Disabled_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(2);
        contest.endTime = LocalDateTime.now().minusHours(1);
        contest.allowAfterEndViewProblem = false;

        assertFalse(policy.canViewProblemDetail(createStudent(), contest));
    }

    // CREATE Permission Tests

    @Test
    @DisplayName("CREATE: null user should deny")
    void testCreate_NullUser_ShouldDeny() {
        Contest contest = createPublicContest(1L);
        assertFalse(policy.can(null, Permission.CREATE, contest));
    }

    /**
     * 封装testCreateSuper管理员ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("CREATE: super admin should allow")
    void testCreate_SuperAdmin_ShouldAllow() {
        Contest contest = createPublicContest(1L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.CREATE, contest));
    }

    /**
     * 封装testCreate教师Content角色ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("CREATE: teacher content role should allow")
    void testCreate_TeacherContentRole_ShouldAllow() {
        Contest contest = createPublicContest(1L);
        AuthUser teacher = createTeacher();
        assertTrue(policy.can(teacher, Permission.CREATE, contest));
    }

    /**
     * 封装testCreateAnother教师Content角色ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("CREATE: another teacher content role should allow")
    void testCreate_AnotherTeacherContentRole_ShouldAllow() {
        Contest contest = createPublicContest(1L);
        AuthUser contentAdmin = createContentAdmin();
        assertTrue(policy.can(contentAdmin, Permission.CREATE, contest));
    }

    /**
     * 封装testCreateStudentShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
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

    /**
     * 封装testUpdateSuper管理员ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("UPDATE: super admin should allow")
    void testUpdate_SuperAdmin_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.UPDATE, contest));
    }

    /**
     * 封装testUpdateOwnerShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("UPDATE: owner should allow")
    void testUpdate_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.UPDATE, contest));
    }

    /**
     * 封装testUpdateOther用户ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
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

    /**
     * 封装testDeleteSuper管理员ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("DELETE: super admin should allow")
    void testDelete_SuperAdmin_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.DELETE, contest));
    }

    /**
     * 封装testDeleteOwnerShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("DELETE: owner should allow")
    void testDelete_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.DELETE, contest));
    }

    /**
     * 封装testDeleteOther用户ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
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

    /**
     * 封装testSubmitBeforeStartShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断；结果依赖当前时间。
     */
    @Test
    @DisplayName("SUBMIT: before contest start should deny")
    void testSubmit_BeforeStart_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().plusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(3);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.SUBMIT, contest));
    }

    /**
     * 封装testSubmitAfterEndShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断；结果依赖当前时间。
     */
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

    /**
     * 封装testSubmitAfterEndAllowedBy配置ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断；结果依赖当前时间。
     */
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

    /**
     * 封装testSubmitSuper管理员ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断；结果依赖当前时间。
     */
    @Test
    @DisplayName("SUBMIT: super admin should deny")
    void testSubmit_SuperAdmin_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(1);
        AuthUser admin = createSuperAdmin();
        assertFalse(policy.can(admin, Permission.SUBMIT, contest));
    }

    /**
     * 封装testSubmitOwnerShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断；结果依赖当前时间。
     */
    @Test
    @DisplayName("SUBMIT: owner should deny")
    void testSubmit_Owner_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(1);
        AuthUser owner = createUser(2L, "TEACHER");
        assertFalse(policy.can(owner, Permission.SUBMIT, contest));
    }

    /**
     * 封装testSubmit管理员AccountShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断；结果依赖当前时间。
     */
    @Test
    @DisplayName("SUBMIT: admin account should deny")
    void testSubmit_AdminAccount_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        contest.startTime = LocalDateTime.now().minusHours(1);
        contest.endTime = LocalDateTime.now().plusHours(1);
        AuthUser adminAccount = createAdminAccount();
        assertFalse(policy.can(adminAccount, Permission.SUBMIT, contest));
    }

    /**
     * 封装testSubmitRegular用户During比赛ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断；结果依赖当前时间。
     */
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

    /**
     * 封装testView榜单DuringFreezeSuper管理员ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("canViewScoreboardDuringFreeze: super admin should allow")
    void testViewScoreboardDuringFreeze_SuperAdmin_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.canViewScoreboardDuringFreeze(admin, contest));
    }

    /**
     * 封装testView榜单DuringFreezeOwnerShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("canViewScoreboardDuringFreeze: owner should allow")
    void testViewScoreboardDuringFreeze_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.canViewScoreboardDuringFreeze(owner, contest));
    }

    /**
     * 封装testView榜单DuringFreezeRegular用户ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
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

    /**
     * 封装testManage报名OwnerShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("MANAGE_REGISTRATION: owner should allow")
    void testManageRegistration_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.MANAGE_REGISTRATION, contest));
    }

    /**
     * 封装testManage报名Other用户ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
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

    /**
     * 封装testRejudgeOwnerShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("REJUDGE: owner should allow")
    void testRejudge_Owner_ShouldAllow() {
        Contest contest = createPublicContest(2L);
        AuthUser owner = createUser(2L, "TEACHER");
        assertTrue(policy.can(owner, Permission.REJUDGE, contest));
    }

    /**
     * 封装testRejudgeOther用户ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("REJUDGE: other user should deny")
    void testRejudge_OtherUser_ShouldDeny() {
        Contest contest = createPublicContest(2L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.REJUDGE, contest));
    }
}
