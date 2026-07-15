package com.qoj.security.policy;

import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;

/**
 * 访问访问策略。根据当前身份、资源归属和操作类型统一作出权限判断。
 */
public abstract class AccessPolicy<T> {

    /**
     * 判断Super管理员是否成立。调用前会结合当前登录身份执行权限判断。
     */
    protected boolean isSuperAdmin(AuthUser user) {
        return user != null && "SUPER_ADMIN".equals(user.role());
    }

    /**
     * 判断Content管理员是否成立。调用前会结合当前登录身份执行权限判断。
     */
    protected boolean isContentAdmin(AuthUser user) {
        return user != null && user.teacherAccount();
    }

    /**
     * 判断教师是否成立。调用前会结合当前登录身份执行权限判断。
     */
    protected boolean isTeacher(AuthUser user) {
        return user != null && user.teacherAccount();
    }

    /**
     * 判断Student是否成立。调用前会结合当前登录身份执行权限判断。
     */
    protected boolean isStudent(AuthUser user) {
        return user != null && "STUDENT".equals(user.role());
    }

    /**
     * 判断Owner是否成立。调用前会结合当前登录身份执行权限判断。
     */
    protected boolean isOwner(T resource, AuthUser user, Long ownerId, String ownerAccountType) {
        if (user == null || ownerId == null) {
            return false;
        }
        return user.accountType().equals(ownerAccountType) && ownerId.equals(user.id());
    }

    /**
     * 辅助方法：记录权限检查结果并返回
     * 当权限被拒绝时自动记录审计日志
     *
     * @param user 当前用户
     * @param permission 请求的权限
     * @param resourceType 资源类型
     * @param resourceId 资源ID
     * @param allowed 是否允许
     * @param reason 原因
     * @param auditLogger 审计日志记录器
     * @return 权限检查结果
     */
    protected boolean checkAndLog(
        AuthUser user,
        Permission permission,
        String resourceType,
        Long resourceId,
        boolean allowed,
        String reason,
        AuditLogger auditLogger
    ) {
        if (!allowed && auditLogger != null) {
            auditLogger.logPermissionDenied(user, permission, resourceType, resourceId, reason);
        }
        return allowed;
    }

    /**
     * 辅助方法：记录敏感权限允许事件
     * 用于记录DELETE、REJUDGE等敏感操作
     */
    protected boolean checkAndLogSensitive(
        AuthUser user,
        Permission permission,
        String resourceType,
        Long resourceId,
        boolean allowed,
        String reason,
        AuditLogger auditLogger
    ) {
        if (auditLogger != null) {
            auditLogger.logPermissionCheck(user, permission, resourceType, resourceId, allowed, reason);
        }
        return allowed;
    }

    /**
     * 判断条件是否成立。调用前会结合当前登录身份执行权限判断。
     */
    public abstract boolean can(AuthUser user, Permission permission, T resource);
}
