package com.qoj.security;

import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.practice.entity.Practice;
import com.qoj.module.practice.mapper.PracticeMapper;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.security.annotation.AdminApi;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 管理端权限拦截器
 * 检查用户是否有权限访问管理端资源
 */
@Component
public class AdminApiInterceptor implements HandlerInterceptor {
    private final ProblemMapper problemMapper;
    private final ContestMapper contestMapper;
    private final PracticeMapper practiceMapper;

    // 从路径中提取资源 ID
    private static final Pattern RESOURCE_ID_PATTERN = Pattern.compile("/(\\d+)(?:/|$)");

    /**
     * 构造 管理员ApiInterceptor 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public AdminApiInterceptor(
        ProblemMapper problemMapper,
        ContestMapper contestMapper,
        PracticeMapper practiceMapper
    ) {
        this.problemMapper = problemMapper;
        this.contestMapper = contestMapper;
        this.practiceMapper = practiceMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        // 检查方法或类上的 @AdminApi 注解
        AdminApi adminApi = handlerMethod.getMethodAnnotation(AdminApi.class);
        if (adminApi == null) {
            adminApi = handlerMethod.getBeanType().getAnnotation(AdminApi.class);
        }

        if (adminApi == null) {
            return true; // 没有注解，放行（由 SecurityConfig 统一控制）
        }

        // 1. 检查用户是否登录
        AuthUser user = CurrentUser.get();
        if (user == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.UNAUTHORIZED, "未登录");
        }

        // 2. 检查用户是否有管理员角色
        if (!user.isAdmin()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "需要管理员权限");
        }

        // 3. 检查资源权限
        if (adminApi.resource() != AdminApi.ResourceType.NONE) {
            checkResourcePermission(user, adminApi, request);
        }

        return true;
    }

    private void checkResourcePermission(AuthUser user, AdminApi adminApi, HttpServletRequest request) {
        // 超级管理员跳过资源权限检查
        if ("SUPER_ADMIN".equals(user.role())) {
            return;
        }

        // 从路径中提取资源 ID
        String path = request.getRequestURI();
        Matcher matcher = RESOURCE_ID_PATTERN.matcher(path);
        Long resourceId = null;
        if (matcher.find()) {
            try {
                resourceId = Long.parseLong(matcher.group(1));
            } catch (NumberFormatException e) {
                // 忽略
            }
        }

        // 如果需要资源所有者权限，检查资源所有权
        if (adminApi.requireOwner() && resourceId != null) {
            checkResourceOwnership(user, adminApi.resource(), resourceId);
        }
    }

    private void checkResourceOwnership(AuthUser user, AdminApi.ResourceType resourceType, Long resourceId) {
        boolean isOwner = switch (resourceType) {
            case PROBLEM -> checkProblemOwnership(user, resourceId);
            case CONTEST -> checkContestOwnership(user, resourceId);
            case PRACTICE -> checkPracticeOwnership(user, resourceId);
            default -> false;
        };

        if (!isOwner) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权操作该资源");
        }
    }

    private boolean checkProblemOwnership(AuthUser user, Long problemId) {
        Problem problem = problemMapper.selectById(problemId);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "题目不存在");
        }

        String ownerAccountType = problem.ownerAccountType == null ? "UNKNOWN" : problem.ownerAccountType;
        return user.accountType().equals(ownerAccountType) && problem.ownerId.equals(user.id());
    }

    private boolean checkContestOwnership(AuthUser user, Long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        // 检查是否是比赛创建者
        return contest.ownerId.equals(user.id()) && user.accountType().equals(contest.ownerAccountType);
    }

    private boolean checkPracticeOwnership(AuthUser user, Long practiceId) {
        Practice practice = practiceMapper.selectById(practiceId);
        if (practice == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "练习不存在");
        }

        // 检查是否是练习创建者（管理员账号创建的练习）
        return practice.ownerId.equals(user.id()) && user.accountType().equals(practice.ownerAccountType);
    }
}
