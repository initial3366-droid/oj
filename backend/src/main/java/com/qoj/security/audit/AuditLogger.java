package com.qoj.security.audit;

import com.qoj.security.AuthUser;
import com.qoj.security.policy.Permission;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 安全审计日志组件
 * 记录所有权限检查事件，用于安全审计和合规性追踪
 */
@Component
public class AuditLogger {
    private static final Logger log = LoggerFactory.getLogger("SECURITY_AUDIT");

    /**
     * 记录权限检查事件
     *
     * @param user 当前用户（可能为null表示匿名用户）
     * @param permission 请求的权限
     * @param resourceType 资源类型（Problem, Contest, Practice, Submission等）
     * @param resourceId 资源ID
     * @param allowed 是否允许访问
     * @param reason 决策原因
     */
    public void logPermissionCheck(
        AuthUser user,
        Permission permission,
        String resourceType,
        Long resourceId,
        boolean allowed,
        String reason
    ) {
        String userId = user != null ? user.id().toString() : "anonymous";
        String username = user != null ? user.getUsername() : "anonymous";
        String role = user != null ? user.role() : "none";
        String result = allowed ? "ALLOWED" : "DENIED";

        log.info("Permission {} | User: {}({}) | Role: {} | Resource: {}#{} | Action: {} | Reason: {}",
            result, username, userId, role, resourceType, resourceId, permission, reason);
    }

    /**
     * 记录权限拒绝事件（简化方法）
     */
    public void logPermissionDenied(
        AuthUser user,
        Permission permission,
        String resourceType,
        Long resourceId,
        String reason
    ) {
        logPermissionCheck(user, permission, resourceType, resourceId, false, reason);
    }

    /**
     * 记录权限允许事件（用于记录敏感操作）
     */
    public void logPermissionAllowed(
        AuthUser user,
        Permission permission,
        String resourceType,
        Long resourceId,
        String reason
    ) {
        logPermissionCheck(user, permission, resourceType, resourceId, true, reason);
    }
}
