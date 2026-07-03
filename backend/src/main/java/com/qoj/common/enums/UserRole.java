package com.qoj.common.enums;

public enum UserRole {
    SUPER_ADMIN,
    TEACHER,
    STUDENT,
    GUEST;

    public static boolean isActiveFrontendRole(String role) {
        return STUDENT.name().equals(role)
            || TEACHER.name().equals(role)
            || GUEST.name().equals(role);
    }
}
