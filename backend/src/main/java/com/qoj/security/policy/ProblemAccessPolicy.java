package com.qoj.security.policy;

import com.qoj.module.problem.entity.Problem;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import org.springframework.stereotype.Component;

/**
 * 题目访问访问策略。根据当前身份、资源归属和操作类型统一作出权限判断。
 */
@Component
public class ProblemAccessPolicy extends AccessPolicy<Problem> {

    private final AuditLogger auditLogger;

    /**
     * 构造 题目访问Policy 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断。
     */
    public ProblemAccessPolicy(AuditLogger auditLogger) {
        this.auditLogger = auditLogger;
    }

    /**
     * 判断条件是否成立。调用前会结合当前登录身份执行权限判断。
     */
    @Override
    public boolean can(AuthUser user, Permission permission, Problem problem) {
        if (problem == null) {
            return false;
        }

        return switch (permission) {
            case VIEW -> canView(user, problem);
            case CREATE -> canCreate(user);
            case UPDATE -> canUpdate(user, problem);
            case DELETE -> canDelete(user, problem);
            case VIEW_HIDDEN_CASE -> canViewHiddenCase(user, problem);
            default -> false;
        };
    }

    /**
     * 判断View是否成立。调用前会结合当前登录身份执行权限判断。
     */
    private boolean canView(AuthUser user, Problem problem) {
        // 公开题目任何人可见
        if (Boolean.TRUE.equals(problem.isPublic)) {
            return true;
        }

        // 未登录用户不能查看非公开题目
        if (user == null) {
            /**
             * 校验AndLog。调用前会结合当前登录身份执行权限判断。
             */
            return checkAndLog(user, Permission.VIEW, "Problem", problem.id, false,
                "未登录且题目非公开", auditLogger);
        }

        // 超级管理员可以查看所有题目
        if (isSuperAdmin(user)) {
            return true;
        }

        // 题目创建者可以查看自己的题目
        if (problem.ownerId != null && problem.ownerId.equals(user.id())) {
            return true;
        }

        /**
         * 校验AndLog。调用前会结合当前登录身份执行权限判断。
         */
        return checkAndLog(user, Permission.VIEW, "Problem", problem.id, false,
            "非题目创建者且题目非公开", auditLogger);
    }

    /**
     * 判断Create是否成立。调用前会结合当前登录身份执行权限判断。
     */
    private boolean canCreate(AuthUser user) {
        if (user == null) {
            auditLogger.logPermissionDenied(user, Permission.CREATE, "Problem", null, "未登录");
            return false;
        }

        boolean allowed = isSuperAdmin(user) || isContentAdmin(user);
        if (!allowed) {
            auditLogger.logPermissionDenied(user, Permission.CREATE, "Problem", null, "角色不足");
        }
        return allowed;
    }

    /**
     * 判断Update是否成立。调用前会结合当前登录身份执行权限判断。
     */
    private boolean canUpdate(AuthUser user, Problem problem) {
        if (user == null) {
            /**
             * 校验AndLog。调用前会结合当前登录身份执行权限判断。
             */
            return checkAndLog(user, Permission.UPDATE, "Problem", problem.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以修改所有题目
        if (isSuperAdmin(user)) {
            return true;
        }

        // 题目创建者可以修改自己的题目
        if (problem.ownerId != null && problem.ownerId.equals(user.id())) {
            return true;
        }

        /**
         * 校验AndLog。调用前会结合当前登录身份执行权限判断。
         */
        return checkAndLog(user, Permission.UPDATE, "Problem", problem.id, false,
            "非题目创建者", auditLogger);
    }

    /**
     * 判断Delete是否成立。调用前会结合当前登录身份执行权限判断。
     */
    private boolean canDelete(AuthUser user, Problem problem) {
        if (user == null) {
            /**
             * 校验AndLogSensitive。调用前会结合当前登录身份执行权限判断。
             */
            return checkAndLogSensitive(user, Permission.DELETE, "Problem", problem.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以删除所有题目
        if (isSuperAdmin(user)) {
            /**
             * 校验AndLogSensitive。调用前会结合当前登录身份执行权限判断。
             */
            checkAndLogSensitive(user, Permission.DELETE, "Problem", problem.id, true,
                "超级管理员", auditLogger);
            return true;
        }

        // 题目创建者可以删除自己的题目
        if (problem.ownerId != null && problem.ownerId.equals(user.id())) {
            /**
             * 校验AndLogSensitive。调用前会结合当前登录身份执行权限判断。
             */
            checkAndLogSensitive(user, Permission.DELETE, "Problem", problem.id, true,
                "题目创建者", auditLogger);
            return true;
        }

        /**
         * 校验AndLogSensitive。调用前会结合当前登录身份执行权限判断。
         */
        return checkAndLogSensitive(user, Permission.DELETE, "Problem", problem.id, false,
            "非题目创建者", auditLogger);
    }

    /**
     * 判断ViewHidden测试点是否成立。调用前会结合当前登录身份执行权限判断。
     */
    private boolean canViewHiddenCase(AuthUser user, Problem problem) {
        if (user == null) {
            /**
             * 校验AndLog。调用前会结合当前登录身份执行权限判断。
             */
            return checkAndLog(user, Permission.VIEW_HIDDEN_CASE, "Problem", problem.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以查看所有测试用例
        if (isSuperAdmin(user)) {
            return true;
        }

        // 题目创建者可以查看自己题目的测试用例
        if (problem.ownerId != null && problem.ownerId.equals(user.id())) {
            return true;
        }

        /**
         * 校验AndLog。调用前会结合当前登录身份执行权限判断。
         */
        return checkAndLog(user, Permission.VIEW_HIDDEN_CASE, "Problem", problem.id, false,
            "非题目创建者", auditLogger);
    }
}
