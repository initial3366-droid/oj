package com.qoj.module.user.vo;

import java.time.LocalDateTime;

/**
 * 用户响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record UserVO(
    Long id,
    String username,
    String displayName,
    String avatarUrl,
    String studentNo,
    String email,
    String role,
    String className,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
