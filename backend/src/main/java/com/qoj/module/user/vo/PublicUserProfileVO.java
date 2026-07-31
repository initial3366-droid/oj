package com.qoj.module.user.vo;

import java.time.LocalDateTime;

/**
 * Public用户资料响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record PublicUserProfileVO(
    Long id,
    String username,
    String displayName,
    String avatarUrl,
    String role,
    Integer acCount,
    Integer submitCount,
    Integer totalScore,
    LocalDateTime createdAt
) {
}
