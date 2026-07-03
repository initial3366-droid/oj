package com.qoj.module.classroom.vo;

import java.time.LocalDateTime;

public record TeacherVO(
    Long id,
    String username,
    String displayName,
    String studentNo,
    String email,
    Integer classCount,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
