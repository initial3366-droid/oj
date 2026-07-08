package com.qoj.module.user.vo;

import java.time.LocalDateTime;

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
