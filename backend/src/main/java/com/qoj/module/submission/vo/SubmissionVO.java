package com.qoj.module.submission.vo;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 提交响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record SubmissionVO(
    Long id,
    Long userId,
    String username,
    String displayName,
    Long problemId,
    String problemTitle,
    Long contestId,
    Long practiceId,
    String language,
    String status,
    Integer timeUsed,
    Integer memoryUsed,
    String identityType,
    Long identityId,
    LocalDateTime submitTime,
    LocalDateTime createdAt,
    Integer passedCaseCount,
    Integer totalCaseCount,
    String code,
    List<SubmissionCaseVO> cases
) {
}
