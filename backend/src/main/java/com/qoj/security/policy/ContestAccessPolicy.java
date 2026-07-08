package com.qoj.security.policy;

import com.qoj.module.contest.entity.Contest;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import java.time.LocalDateTime;
import org.springframework.stereotype.Component;

@Component
public class ContestAccessPolicy extends AccessPolicy<Contest> {

    private final AuditLogger auditLogger;

    public ContestAccessPolicy(AuditLogger auditLogger) {
        this.auditLogger = auditLogger;
    }

    @Override
    public boolean can(AuthUser user, Permission permission, Contest contest) {
        if (contest == null) {
            return false;
        }

        return switch (permission) {
            case VIEW -> canView(user, contest);
            case CREATE -> canCreate(user);
            case UPDATE -> canUpdate(user, contest);
            case DELETE -> canDelete(user, contest);
            case SUBMIT -> canSubmit(user, contest);
            case MANAGE_REGISTRATION -> canManageRegistration(user, contest);
            case MANAGE_SCOREBOARD -> canManageScoreboard(user, contest);
            case REJUDGE -> canRejudge(user, contest);
            default -> false;
        };
    }

    private boolean canView(AuthUser user, Contest contest) {
        // 超级管理员可以查看所有比赛
        if (isSuperAdmin(user)) {
            return true;
        }

        // 比赛创建者可以查看自己的比赛
        if (isOwner(contest, user, contest.ownerId, contest.ownerAccountType)) {
            return true;
        }

        // 如果是公开比赛（audience = ALL），任何人可见
        if ("ALL".equals(contest.audience)) {
            return true;
        }

        // 非公开比赛需要检查用户是否在目标受众中
        // 这部分需要在Service层配合数据库查询判断
        return checkAndLog(user, Permission.VIEW, "Contest", contest.id, false,
            "非公开比赛且用户不在目标受众中", auditLogger);
    }

    public boolean canViewProblemDetail(AuthUser user, Contest contest) {
        LocalDateTime now = LocalDateTime.now();

        // 比赛未开始
        if (now.isBefore(contest.startTime)) {
            // 超级管理员和创建者可以提前查看
            if (user != null && (isSuperAdmin(user) || isOwner(contest, user, contest.ownerId, contest.ownerAccountType))) {
                return true;
            }
            auditLogger.logPermissionDenied(user, Permission.VIEW, "ContestProblem", contest.id,
                "比赛未开始");
            return false;
        }
        if (now.isAfter(contest.endTime)
            && Boolean.FALSE.equals(contest.allowAfterEndViewProblem)
            && (user == null || (!isSuperAdmin(user) && !isOwner(contest, user, contest.ownerId, contest.ownerAccountType)))) {
            auditLogger.logPermissionDenied(user, Permission.VIEW, "ContestProblem", contest.id,
                "赛后题目查看已关闭");
            return false;
        }

        // 比赛已开始或已结束，需要有查看比赛的权限
        return canView(user, contest);
    }

    private boolean canCreate(AuthUser user) {
        if (user == null) {
            auditLogger.logPermissionDenied(user, Permission.CREATE, "Contest", null, "未登录");
            return false;
        }

        boolean allowed = isSuperAdmin(user) || isContentAdmin(user);
        if (!allowed) {
            auditLogger.logPermissionDenied(user, Permission.CREATE, "Contest", null, "角色不足");
        }
        return allowed;
    }

    private boolean canUpdate(AuthUser user, Contest contest) {
        if (user == null) {
            return checkAndLog(user, Permission.UPDATE, "Contest", contest.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以修改所有比赛
        if (isSuperAdmin(user)) {
            return true;
        }

        // 比赛创建者可以修改自己的比赛
        if (isOwner(contest, user, contest.ownerId, contest.ownerAccountType)) {
            return true;
        }

        return checkAndLog(user, Permission.UPDATE, "Contest", contest.id, false,
            "非比赛创建者", auditLogger);
    }

    private boolean canDelete(AuthUser user, Contest contest) {
        if (user == null) {
            return checkAndLogSensitive(user, Permission.DELETE, "Contest", contest.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以删除所有比赛
        if (isSuperAdmin(user)) {
            checkAndLogSensitive(user, Permission.DELETE, "Contest", contest.id, true,
                "超级管理员", auditLogger);
            return true;
        }

        // 比赛创建者可以删除自己的比赛
        if (isOwner(contest, user, contest.ownerId, contest.ownerAccountType)) {
            checkAndLogSensitive(user, Permission.DELETE, "Contest", contest.id, true,
                "比赛创建者", auditLogger);
            return true;
        }

        return checkAndLogSensitive(user, Permission.DELETE, "Contest", contest.id, false,
            "非比赛创建者", auditLogger);
    }

    private boolean canSubmit(AuthUser user, Contest contest) {
        if (user == null) {
            return checkAndLog(user, Permission.SUBMIT, "Contest", contest.id, false,
                "未登录", auditLogger);
        }

        LocalDateTime now = LocalDateTime.now();

        // 比赛未开始不能提交；比赛结束后是否允许继续提交由后台配置控制。
        if (now.isBefore(contest.startTime)
            || (now.isAfter(contest.endTime) && !Boolean.TRUE.equals(contest.allowAfterEndSubmit))) {
            return checkAndLog(user, Permission.SUBMIT, "Contest", contest.id, false,
                "比赛未开始或已结束", auditLogger);
        }

        // 超级管理员和比赛创建者不能提交
        if (isSuperAdmin(user) || isOwner(contest, user, contest.ownerId, contest.ownerAccountType)) {
            return checkAndLog(user, Permission.SUBMIT, "Contest", contest.id, false,
                "管理员不能提交", auditLogger);
        }

        // 后台账号不能提交
        if (user.adminAccount()) {
            return checkAndLog(user, Permission.SUBMIT, "Contest", contest.id, false,
                "后台账号不能提交", auditLogger);
        }

        // 其他情况需要检查是否已报名（在Service层判断）
        return true;
    }

    private boolean canManageRegistration(AuthUser user, Contest contest) {
        if (user == null) {
            return checkAndLog(user, Permission.MANAGE_REGISTRATION, "Contest", contest.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以管理所有报名
        if (isSuperAdmin(user)) {
            return true;
        }

        // 比赛创建者可以管理报名
        if (isOwner(contest, user, contest.ownerId, contest.ownerAccountType)) {
            return true;
        }

        return checkAndLog(user, Permission.MANAGE_REGISTRATION, "Contest", contest.id, false,
            "非比赛创建者", auditLogger);
    }

    private boolean canManageScoreboard(AuthUser user, Contest contest) {
        if (user == null) {
            return checkAndLog(user, Permission.MANAGE_SCOREBOARD, "Contest", contest.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以管理所有榜单
        if (isSuperAdmin(user)) {
            return true;
        }

        // 比赛创建者可以管理榜单
        if (isOwner(contest, user, contest.ownerId, contest.ownerAccountType)) {
            return true;
        }

        return checkAndLog(user, Permission.MANAGE_SCOREBOARD, "Contest", contest.id, false,
            "非比赛创建者", auditLogger);
    }

    private boolean canRejudge(AuthUser user, Contest contest) {
        if (user == null) {
            return checkAndLogSensitive(user, Permission.REJUDGE, "Contest", contest.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以重判所有比赛
        if (isSuperAdmin(user)) {
            checkAndLogSensitive(user, Permission.REJUDGE, "Contest", contest.id, true,
                "超级管理员", auditLogger);
            return true;
        }

        // 比赛创建者可以重判自己的比赛
        if (isOwner(contest, user, contest.ownerId, contest.ownerAccountType)) {
            checkAndLogSensitive(user, Permission.REJUDGE, "Contest", contest.id, true,
                "比赛创建者", auditLogger);
            return true;
        }

        return checkAndLogSensitive(user, Permission.REJUDGE, "Contest", contest.id, false,
            "非比赛创建者", auditLogger);
    }

    public boolean canViewScoreboardDuringFreeze(AuthUser user, Contest contest) {
        if (user == null) {
            auditLogger.logPermissionDenied(user, Permission.VIEW, "ContestScoreboard", contest.id,
                "未登录");
            return false;
        }

        // 超级管理员可以查看
        if (isSuperAdmin(user)) {
            return true;
        }

        // 比赛创建者可以查看
        if (isOwner(contest, user, contest.ownerId, contest.ownerAccountType)) {
            return true;
        }

        auditLogger.logPermissionDenied(user, Permission.VIEW, "ContestScoreboard", contest.id,
            "榜单封榜期间非创建者");
        return false;
    }
}
