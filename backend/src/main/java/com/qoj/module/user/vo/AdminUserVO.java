package com.qoj.module.user.vo;

import java.time.LocalDateTime;

/** 管理后台用户视图，包含列表需要的 AC 统计。 */
public record AdminUserVO(
    Long id,
    String username,
    String displayName,
    String avatarUrl,
    String studentNo,
    String email,
    String role,
    String status,
    String className,
    Long classId,
    Integer acCount,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    LocalDateTime lastSubmissionTime
) {
}
