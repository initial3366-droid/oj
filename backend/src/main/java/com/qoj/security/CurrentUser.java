package com.qoj.security;

import com.qoj.common.exception.BizException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Current用户领域类型。封装 qoj.security 模块内的相关职责。
 */
public final class CurrentUser {

    /**
     * 构造 Current用户 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断。
     */
    private CurrentUser() {
    }

    /**
     * 读取目标数据并返回给调用方。调用前会结合当前登录身份执行权限判断。
     */
    public static AuthUser get() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthUser authUser) {
            return authUser;
        }
        return null;
    }

    /**
     * 校验d。调用前会结合当前登录身份执行权限判断；不满足业务约束时直接抛出明确异常。
     */
    public static AuthUser required() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUser authUser)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(401, "未登录");
        }
        return authUser;
    }

    /**
     * 封装标识相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static Long id() {
        /**
         * 校验d。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return required().id();
    }
}
