package com.qoj.security.policy;

import com.qoj.module.submission.entity.Submission;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 提交访问Policy访问策略。根据当前身份、资源归属和操作类型统一作出权限判断。
 */
@DisplayName("SubmissionAccessPolicy Tests")
class SubmissionAccessPolicyTest {

    private SubmissionAccessPolicy policy;

    /**
     * 封装setUp相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @BeforeEach
    void setUp() {
        AuditLogger auditLogger = new AuditLogger();
        policy = new SubmissionAccessPolicy(auditLogger);
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
     * 创建或提交用户。调用前会结合当前登录身份执行权限判断。
     */
    private AuthUser createUser(Long userId, String role) {
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
     * 创建或提交提交。直接返回当前实例保存的提交，不产生额外的数据写入。
     */
    private Submission createSubmission(Long userId) {
        Submission submission = new Submission();
        submission.id = 1L;
        submission.userId = userId;
        submission.problemId = 1L;
        submission.language = "cpp";
        submission.code = "int main() { return 0; }";
        submission.status = "ACCEPTED";
        return submission;
    }

    // VIEW Permission Tests

    @Test
    @DisplayName("VIEW: null submission should deny")
    void testView_NullSubmission_ShouldDeny() {
        AuthUser user = createStudent();
        assertFalse(policy.can(user, Permission.VIEW, null));
    }

    /**
     * 封装testViewOwnerOrSuper管理员ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("VIEW: only owner and super admin can view submission detail by default")
    void testView_OwnerOrSuperAdmin_ShouldAllow() {
        Submission submission = createSubmission(4L);

        assertFalse(policy.can(null, Permission.VIEW, submission));

        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.VIEW, submission));

        AuthUser student = createStudent();
        assertTrue(policy.can(student, Permission.VIEW, submission));

        AuthUser other = createUser(999L, "STUDENT");
        assertFalse(policy.can(other, Permission.VIEW, submission));
    }

    // VIEW_CODE Permission Tests

    @Test
    @DisplayName("VIEW_CODE: null submission should deny")
    void testViewCode_NullSubmission_ShouldDeny() {
        AuthUser user = createStudent();
        assertFalse(policy.can(user, Permission.VIEW_CODE, null));
    }

    /**
     * 封装testView编码Null用户ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("VIEW_CODE: null user should deny")
    void testViewCode_NullUser_ShouldDeny() {
        Submission submission = createSubmission(4L);
        assertFalse(policy.can(null, Permission.VIEW_CODE, submission));
    }

    /**
     * 封装testView编码Super管理员ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("VIEW_CODE: super admin can view any submission code")
    void testViewCode_SuperAdmin_ShouldAllow() {
        Submission submission = createSubmission(4L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.VIEW_CODE, submission));
    }

    /**
     * 封装testView编码Owner用户ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("VIEW_CODE: user can view their own submission code")
    void testViewCode_OwnerUser_ShouldAllow() {
        Submission submission = createSubmission(4L);
        AuthUser owner = createStudent();
        assertTrue(policy.can(owner, Permission.VIEW_CODE, submission));
    }

    /**
     * 封装testView编码Other用户ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("VIEW_CODE: other user cannot view submission code")
    void testViewCode_OtherUser_ShouldDeny() {
        Submission submission = createSubmission(4L);
        AuthUser other = createUser(999L, "STUDENT");
        assertFalse(policy.can(other, Permission.VIEW_CODE, submission));
    }

    /**
     * 封装testView编码教师Other用户ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("VIEW_CODE: teacher cannot view other's code by default")
    void testViewCode_Teacher_OtherUser_ShouldDeny() {
        Submission submission = createSubmission(4L);
        AuthUser teacher = createTeacher();
        assertFalse(policy.can(teacher, Permission.VIEW_CODE, submission));
    }

    // REJUDGE Permission Tests

    @Test
    @DisplayName("REJUDGE: null submission should deny")
    void testRejudge_NullSubmission_ShouldDeny() {
        AuthUser user = createStudent();
        assertFalse(policy.can(user, Permission.REJUDGE, null));
    }

    /**
     * 封装testRejudgeNull用户ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("REJUDGE: null user should deny")
    void testRejudge_NullUser_ShouldDeny() {
        Submission submission = createSubmission(4L);
        assertFalse(policy.can(null, Permission.REJUDGE, submission));
    }

    /**
     * 封装testRejudgeSuper管理员ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("REJUDGE: only super admin can rejudge")
    void testRejudge_SuperAdmin_ShouldAllow() {
        Submission submission = createSubmission(4L);
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.can(admin, Permission.REJUDGE, submission));
    }

    /**
     * 封装testRejudge教师ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("REJUDGE: teacher cannot rejudge")
    void testRejudge_Teacher_ShouldDeny() {
        Submission submission = createSubmission(4L);
        AuthUser teacher = createTeacher();
        assertFalse(policy.can(teacher, Permission.REJUDGE, submission));
    }

    /**
     * 封装testRejudge教师Content角色ShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("REJUDGE: teacher content role cannot rejudge")
    void testRejudge_TeacherContentRole_ShouldDeny() {
        Submission submission = createSubmission(4L);
        AuthUser contentAdmin = createContentAdmin();
        assertFalse(policy.can(contentAdmin, Permission.REJUDGE, submission));
    }

    /**
     * 封装testRejudgeStudentShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("REJUDGE: student cannot rejudge")
    void testRejudge_Student_ShouldDeny() {
        Submission submission = createSubmission(4L);
        AuthUser student = createStudent();
        assertFalse(policy.can(student, Permission.REJUDGE, submission));
    }

    /**
     * 封装testRejudgeOwnerShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("REJUDGE: owner cannot rejudge their own submission")
    void testRejudge_Owner_ShouldDeny() {
        Submission submission = createSubmission(4L);
        AuthUser owner = createStudent();
        assertFalse(policy.can(owner, Permission.REJUDGE, submission));
    }

    // canViewInList Tests

    @Test
    @DisplayName("canViewInList: null user should deny")
    void testViewInList_NullUser_ShouldDeny() {
        assertFalse(policy.canViewInList(null, 4L));
    }

    /**
     * 封装testViewIn列表Super管理员ShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("canViewInList: super admin can view all submissions")
    void testViewInList_SuperAdmin_ShouldAllow() {
        AuthUser admin = createSuperAdmin();
        assertTrue(policy.canViewInList(admin, 4L));
        assertTrue(policy.canViewInList(admin, 999L));
    }

    /**
     * 封装testViewIn列表教师ShouldDenyOtherUsers相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("canViewInList: teacher cannot view other users' submissions")
    void testViewInList_Teacher_ShouldDenyOtherUsers() {
        AuthUser teacher = createTeacher();
        assertFalse(policy.canViewInList(teacher, 4L));
    }

    /**
     * 封装testViewIn列表教师Content角色ShouldDenyOtherUsers相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("canViewInList: teacher content role cannot view other users' submissions")
    void testViewInList_TeacherContentRole_ShouldDenyOtherUsers() {
        AuthUser contentAdmin = createContentAdmin();
        assertFalse(policy.canViewInList(contentAdmin, 4L));
    }

    /**
     * 封装testViewIn列表OwnSubmissionsShouldAllow相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("canViewInList: user can view their own submissions")
    void testViewInList_OwnSubmissions_ShouldAllow() {
        AuthUser student = createStudent();
        assertTrue(policy.canViewInList(student, 4L));
    }

    /**
     * 封装testViewIn列表OtherSubmissionsShouldDeny相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @Test
    @DisplayName("canViewInList: user cannot view other's submissions")
    void testViewInList_OtherSubmissions_ShouldDeny() {
        AuthUser student = createStudent();
        assertFalse(policy.canViewInList(student, 999L));
    }

    // Unsupported Permission Tests

    @Test
    @DisplayName("Unsupported permission should deny")
    void testUnsupportedPermission_ShouldDeny() {
        Submission submission = createSubmission(1L);
        AuthUser admin = createSuperAdmin();
        assertFalse(policy.can(admin, Permission.CREATE, submission));
        assertFalse(policy.can(admin, Permission.UPDATE, submission));
        assertFalse(policy.can(admin, Permission.DELETE, submission));
        assertFalse(policy.can(admin, Permission.SUBMIT, submission));
        assertFalse(policy.can(admin, Permission.VIEW_HIDDEN_CASE, submission));
    }
}
