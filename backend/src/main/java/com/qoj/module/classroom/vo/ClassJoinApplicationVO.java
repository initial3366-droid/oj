package com.qoj.module.classroom.vo;

import java.time.LocalDateTime;

/**
 * 班级JoinApplication响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ClassJoinApplicationVO(
    Long id,
    Long classId,
    String className,
    Long userId,
    String username,
    String displayName,
    String avatarUrl,
    String studentNo,
    String status,
    String reason,
    LocalDateTime createdAt,
    LocalDateTime handledAt
) {
}
