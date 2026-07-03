package com.qoj.module.practice.vo;

import java.time.LocalDateTime;

public record PracticeSubmissionVO(
    Long id,
    Long userId,
    String displayName,
    Long problemId,
    String problemTitle,
    String language,
    String status,
    Integer timeUsed,
    Integer memoryUsed,
    LocalDateTime createdAt
) {
}
