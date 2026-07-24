package com.qoj.module.teacher.vo;

import java.time.LocalDateTime;

public record MajorVO(
    Long id,
    String code,
    String name,
    String status,
    Long teacherCount,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
