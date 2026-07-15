package com.qoj.security.policy;

import com.qoj.module.practice.entity.Practice;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import org.springframework.stereotype.Component;

/**
 * 练习访问访问策略。根据当前身份、资源归属和操作类型统一作出权限判断。
 */
@Component
public class PracticeAccessPolicy extends AccessPolicy<Practice> {

    private final AuditLogger auditLogger;
    private final ResourceAccessService resourceAccessService;

    /**
     * 构造 练习访问Policy 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断。
     */
    public PracticeAccessPolicy(AuditLogger auditLogger, ResourceAccessService resourceAccessService) {
        this.auditLogger = auditLogger;
        this.resourceAccessService = resourceAccessService;
    }

    /**
     * 判断条件是否成立。调用前会结合当前登录身份执行权限判断。
     */
    @Override
    public boolean can(AuthUser user, Permission permission, Practice practice) {
        if (practice == null) {
            return false;
        }

        return switch (permission) {
            case VIEW -> canView(user, practice);
            case CREATE -> canCreate(user);
            case UPDATE -> canUpdate(user, practice);
            case DELETE -> canDelete(user, practice);
            case SUBMIT -> canSubmit(user, practice);
            default -> false;
        };
    }

    /**
     * 判断View是否成立。调用前会结合当前登录身份执行权限判断；在状态变化后发布异步消息。
     */
    private boolean canView(AuthUser user, Practice practice) {
        boolean allowed = resourceAccessService.canAccessPractice(user, practice);
        return allowed || checkAndLog(user, Permission.VIEW, "Practice", practice.id, false,
            "题单专业权限不匹配", auditLogger);
    }

    /**
     * 判断Create是否成立。调用前会结合当前登录身份执行权限判断。
     */
    private boolean canCreate(AuthUser user) {
        if (user == null) {
            auditLogger.logPermissionDenied(user, Permission.CREATE, "Practice", null, "未登录");
            return false;
        }

        boolean allowed = isSuperAdmin(user) || isContentAdmin(user);
        if (!allowed) {
            auditLogger.logPermissionDenied(user, Permission.CREATE, "Practice", null, "角色不足");
        }
        return allowed;
    }

    /**
     * 判断Update是否成立。调用前会结合当前登录身份执行权限判断。
     */
    private boolean canUpdate(AuthUser user, Practice practice) {
        if (user == null) {
            /**
             * 校验AndLog。调用前会结合当前登录身份执行权限判断。
             */
            return checkAndLog(user, Permission.UPDATE, "Practice", practice.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以修改所有练习
        if (isSuperAdmin(user)) {
            return true;
        }

        // 练习创建者可以修改自己的练习
        if (resourceAccessService.isOwner(user, practice.ownerAccountType, practice.ownerId)) {
            return true;
        }

        /**
         * 校验AndLog。调用前会结合当前登录身份执行权限判断。
         */
        return checkAndLog(user, Permission.UPDATE, "Practice", practice.id, false,
            "非练习创建者", auditLogger);
    }

    /**
     * 判断Delete是否成立。调用前会结合当前登录身份执行权限判断。
     */
    private boolean canDelete(AuthUser user, Practice practice) {
        if (user == null) {
            /**
             * 校验AndLogSensitive。调用前会结合当前登录身份执行权限判断。
             */
            return checkAndLogSensitive(user, Permission.DELETE, "Practice", practice.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以删除所有练习
        if (isSuperAdmin(user)) {
            /**
             * 校验AndLogSensitive。调用前会结合当前登录身份执行权限判断。
             */
            checkAndLogSensitive(user, Permission.DELETE, "Practice", practice.id, true,
                "超级管理员", auditLogger);
            return true;
        }

        // 练习创建者可以删除自己的练习
        if (resourceAccessService.isOwner(user, practice.ownerAccountType, practice.ownerId)) {
            /**
             * 校验AndLogSensitive。调用前会结合当前登录身份执行权限判断。
             */
            checkAndLogSensitive(user, Permission.DELETE, "Practice", practice.id, true,
                "练习创建者", auditLogger);
            return true;
        }

        /**
         * 校验AndLogSensitive。调用前会结合当前登录身份执行权限判断。
         */
        return checkAndLogSensitive(user, Permission.DELETE, "Practice", practice.id, false,
            "非练习创建者", auditLogger);
    }

    /**
     * 判断Submit是否成立。调用前会结合当前登录身份执行权限判断；在状态变化后发布异步消息。
     */
    private boolean canSubmit(AuthUser user, Practice practice) {
        if (user == null) {
            /**
             * 校验AndLog。调用前会结合当前登录身份执行权限判断。
             */
            return checkAndLog(user, Permission.SUBMIT, "Practice", practice.id, false,
                "未登录", auditLogger);
        }

        // 后台账号不能提交
        if (user.adminAccount()) {
            /**
             * 校验AndLog。调用前会结合当前登录身份执行权限判断。
             */
            return checkAndLog(user, Permission.SUBMIT, "Practice", practice.id, false,
                "后台账号不能提交", auditLogger);
        }

        return checkAndLog(user, Permission.SUBMIT, "Practice", practice.id, false,
            "题单模板不可直接提交，请使用发布实例", auditLogger);
    }
}
