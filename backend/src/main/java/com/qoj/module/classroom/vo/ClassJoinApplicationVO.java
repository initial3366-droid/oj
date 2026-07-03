package com.qoj.module.classroom.vo;

import java.time.LocalDateTime;

public record ClassJoinApplicationVO(
    Long id,
    Long classId,
    String className,
    Long userId,
    String username,
    String displayName,
    String studentNo,
    String status,
    String reason,
    LocalDateTime createdAt,
    LocalDateTime handledAt
) {
}
