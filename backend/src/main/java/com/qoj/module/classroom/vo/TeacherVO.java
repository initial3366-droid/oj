package com.qoj.module.classroom.vo;

import java.time.LocalDateTime;

/**
 * 教师响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
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
