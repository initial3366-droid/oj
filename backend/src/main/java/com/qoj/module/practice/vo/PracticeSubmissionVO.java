package com.qoj.module.practice.vo;

import java.time.LocalDateTime;

/**
 * 练习提交响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
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
