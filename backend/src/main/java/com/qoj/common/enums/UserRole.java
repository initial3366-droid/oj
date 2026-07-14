package com.qoj.common.enums;

/**
 * 用户角色枚举。限定该领域允许出现的离散状态，避免在业务代码中传播无约束字符串。
 */
public enum UserRole {
    SUPER_ADMIN,
    TEACHER,
    STUDENT,
    GUEST;

    /**
     * 判断有效Frontend角色是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static boolean isActiveFrontendRole(String role) {
        return STUDENT.name().equals(role)
            || TEACHER.name().equals(role)
            || GUEST.name().equals(role);
    }
}
