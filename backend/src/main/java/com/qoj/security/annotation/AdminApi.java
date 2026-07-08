package com.qoj.security.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 管理端权限注解
 * 标记在管理端 Controller 方法上，自动检查：
 * 1. 用户是否登录
 * 2. 用户是否有管理员角色
 * 3. 用户是否有对应资源的操作权限
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface AdminApi {

    /**
     * 需要的资源权限
     * 例如：PROBLEM, CONTEST, PRACTICE, USER, ORGANIZATION
     */
    ResourceType resource() default ResourceType.NONE;

    /**
     * 需要的操作权限
     * 例如：READ, CREATE, UPDATE, DELETE
     */
    Action action() default Action.READ;

    /**
     * 是否需要资源所有者权限
     * true: 只有资源创建者或超级管理员可以操作
     * false: 所有管理员都可以操作
     */
    boolean requireOwner() default false;

    /**
     * 资源类型
     */
    enum ResourceType {
        NONE,           // 无需资源权限检查
        PROBLEM,        // 题目
        CONTEST,        // 比赛
        PRACTICE,       // 练习
        USER,           // 用户
        ORGANIZATION,   // 组织
        SUBMISSION,     // 提交
        ANNOUNCEMENT    // 公告
    }

    /**
     * 操作类型
     */
    enum Action {
        READ,    // 读取
        CREATE,  // 创建
        UPDATE,  // 更新
        DELETE   // 删除
    }
}
