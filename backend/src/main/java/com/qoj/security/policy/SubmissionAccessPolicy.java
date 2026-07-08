package com.qoj.security.policy;

import com.qoj.module.submission.entity.Submission;
import com.qoj.security.AuthUser;
import com.qoj.security.audit.AuditLogger;
import org.springframework.stereotype.Component;

@Component
public class SubmissionAccessPolicy extends AccessPolicy<Submission> {

    private final AuditLogger auditLogger;

    public SubmissionAccessPolicy(AuditLogger auditLogger) {
        this.auditLogger = auditLogger;
    }

    @Override
    public boolean can(AuthUser user, Permission permission, Submission submission) {
        if (submission == null) {
            return false;
        }

        return switch (permission) {
            case VIEW -> canView(user, submission);
            case VIEW_CODE -> canViewCode(user, submission);
            case REJUDGE -> canRejudge(user, submission);
            default -> false;
        };
    }

    private boolean canView(AuthUser user, Submission submission) {
        if (user == null) {
            return checkAndLog(user, Permission.SUBMISSION_VIEW_SELF, "Submission", submission.id, false,
                "未登录", auditLogger);
        }

        if (isSuperAdmin(user)) {
            return true;
        }

        if (submission.userId.equals(user.id())) {
            return true;
        }

        return checkAndLog(user, Permission.SUBMISSION_VIEW_SELF, "Submission", submission.id, false,
            "非本人提交", auditLogger);
    }

    public boolean canViewCode(AuthUser user, Submission submission) {
        if (user == null) {
            return checkAndLog(user, Permission.VIEW_CODE, "Submission", submission.id, false,
                "未登录", auditLogger);
        }

        // 超级管理员可以查看所有提交代码
        if (isSuperAdmin(user)) {
            return true;
        }

        // 用户可以查看自己的提交代码
        if (submission.userId.equals(user.id())) {
            return true;
        }

        return checkAndLog(user, Permission.VIEW_CODE, "Submission", submission.id, false,
            "非本人提交且无管理权限", auditLogger);
    }

    private boolean canRejudge(AuthUser user, Submission submission) {
        if (user == null) {
            return checkAndLogSensitive(user, Permission.REJUDGE, "Submission", submission.id, false,
                "未登录", auditLogger);
        }

        // 只有超级管理员可以重判
        boolean allowed = isSuperAdmin(user);
        if (allowed) {
            checkAndLogSensitive(user, Permission.REJUDGE, "Submission", submission.id, true,
                "超级管理员", auditLogger);
        } else {
            checkAndLogSensitive(user, Permission.REJUDGE, "Submission", submission.id, false,
                "非超级管理员", auditLogger);
        }
        return allowed;
    }

    public boolean canViewInList(AuthUser user, Long submissionUserId) {
        if (user == null) {
            auditLogger.logPermissionDenied(user, Permission.VIEW, "SubmissionList", submissionUserId,
                "未登录");
            return false;
        }

        // 超级管理员可以查看所有提交
        if (isSuperAdmin(user)) {
            return true;
        }

        // 用户可以查看自己的提交
        boolean allowed = submissionUserId.equals(user.id());
        if (!allowed) {
            auditLogger.logPermissionDenied(user, Permission.VIEW, "SubmissionList", submissionUserId,
                "非本人且无管理权限");
        }
        return allowed;
    }
}
