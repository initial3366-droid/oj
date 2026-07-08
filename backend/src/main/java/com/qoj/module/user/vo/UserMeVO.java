package com.qoj.module.user.vo;

public record UserMeVO(
    Long id,
    String username,
    String displayName,
    String avatarUrl,
    String studentNo,
    String email,
    String role,
    Integer totalSolved,
    Integer totalSubmissions,
    Long classId,
    String className
) {
}
