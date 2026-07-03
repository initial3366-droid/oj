package com.qoj.security.policy;

import com.qoj.module.problem.entity.Problem;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import org.springframework.stereotype.Component;

@Component
public class ProblemAccessPolicy extends AccessPolicy<Problem> {

    private final AuditLogger auditLogger;

    public ProblemAccessPolicy(AuditLogger auditLogger) {
        this.auditLogger = auditLogger;
    }

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

    private boolean canView(AuthUser user, Problem problem) {
        // 公开题目任何人可见
        if (Boolean.TRUE.equals(problem.isPublic)) {
            return true;
        }

        // 未登录用户不能查看非公开题目
        if (user == null) {
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

        return checkAndLog(user, Permission.VIEW, "Problem", problem.id, false,
            "非题目创建者且题目非公开", auditLogger);
    }

    private boolean canCreate(AuthUser user) {
        if (user == null) {
            auditLogger.logPermissionDenied(user, Permission.CREATE, "Problem", null, "未登录");
            return false;
        }

        boolean allowed = isSuperAdmin(user) || isClubAdmin(user) || isTeacher(user);
        if (!allowed) {
            auditLogger.logPermissionDenied(user, Permission.CREATE, "Problem", null, "角色不足");
        }
        return allowed;
    }

    private boolean canUpdate(AuthUser user, Problem problem) {
        if (user == null) {
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

        return checkAndLog(user, Permission.UPDATE, "Problem", problem.id, false,
            "非题目创建者", auditLogger);
    }

    private boolean canDelete(AuthUser user, Problem problem) {
        if (user == null) {
            return checkAndLogSensitive(user, Permission.DELETE, "Problem", problem.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以删除所有题目
        if (isSuperAdmin(user)) {
            checkAndLogSensitive(user, Permission.DELETE, "Problem", problem.id, true,
                "超级管理员", auditLogger);
            return true;
        }

        // 题目创建者可以删除自己的题目
        if (problem.ownerId != null && problem.ownerId.equals(user.id())) {
            checkAndLogSensitive(user, Permission.DELETE, "Problem", problem.id, true,
                "题目创建者", auditLogger);
            return true;
        }

        return checkAndLogSensitive(user, Permission.DELETE, "Problem", problem.id, false,
            "非题目创建者", auditLogger);
    }

    private boolean canViewHiddenCase(AuthUser user, Problem problem) {
        if (user == null) {
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

        return checkAndLog(user, Permission.VIEW_HIDDEN_CASE, "Problem", problem.id, false,
            "非题目创建者", auditLogger);
    }
}
