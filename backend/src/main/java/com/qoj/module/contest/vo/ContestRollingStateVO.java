package com.qoj.module.contest.vo;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 比赛RollingState响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ContestRollingStateVO(
    Long contestId,
    String status,
    Integer currentStep,
    Integer totalSteps,
    Boolean publishedFinal,
    List<ContestRollingStepVO> steps,
    LocalDateTime startedAt,
    LocalDateTime publishedAt,
    LocalDateTime updatedAt
) {
}
