package com.qoj.security.audit;

import com.qoj.security.AuthUser;
import com.qoj.security.policy.Permission;
import com.qoj.module.user.entity.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 审计日志功能测试
 */
@ExtendWith(MockitoExtension.class)
class AuditLoggerTest {

    @InjectMocks
    private AuditLogger auditLogger;

    @Test
    void testLogPermissionDenied() {
        // 创建测试用户
        User user = new User();
        user.id = 123L;
        user.username = "testuser";
        user.role = "STUDENT";
        AuthUser authUser = new AuthUser(user);

        // 测试记录权限拒绝
        auditLogger.logPermissionDenied(
            authUser,
            Permission.VIEW,
            "Problem",
            456L,
            "未登录且题目非公开"
        );

        // 由于是日志输出，这里只验证方法调用不会抛异常
        // 实际验证需要查看日志文件
    }

    @Test
    void testLogPermissionDeniedAnonymous() {
        // 测试匿名用户的权限拒绝
        auditLogger.logPermissionDenied(
            null,
            Permission.VIEW,
            "Contest",
            100L,
            "未登录"
        );
    }

    @Test
    void testLogPermissionAllowed() {
        User user = new User();
        user.id = 1L;
        user.username = "admin";
        user.role = "SUPER_ADMIN";
        AuthUser authUser = new AuthUser(user);

        // 测试记录敏感操作
        auditLogger.logPermissionAllowed(
            authUser,
            Permission.DELETE,
            "Problem",
            456L,
            "超级管理员"
        );
    }

    @Test
    void testLogPermissionCheck() {
        User user = new User();
        user.id = 789L;
        user.username = "teacher";
        user.role = "TEACHER";
        AuthUser authUser = new AuthUser(user);

        // 测试完整的权限检查日志
        auditLogger.logPermissionCheck(
            authUser,
            Permission.UPDATE,
            "Contest",
            200L,
            true,
            "比赛创建者"
        );

        auditLogger.logPermissionCheck(
            authUser,
            Permission.DELETE,
            "Contest",
            200L,
            false,
            "非比赛创建者"
        );
    }
}
