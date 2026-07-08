package com.qoj.module.user.vo;

import java.time.LocalDateTime;

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
