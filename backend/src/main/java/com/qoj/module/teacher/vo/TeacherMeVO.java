package com.qoj.module.teacher.vo;

public record TeacherMeVO(
    Long id,
    String username,
    String displayName,
    String avatarUrl,
    String teacherNo,
    String email,
    String role,
    Long majorId,
    String majorName
) {
}
