package com.qoj.module.contest.vo;

/**
 * Acm题目状态响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record AcmProblemStatusVO(
    Long contestProblemId,
    String label,
    Boolean isSolved,
    Integer wrongAttempts,
    Integer solveTimeMinutes
) {
}
