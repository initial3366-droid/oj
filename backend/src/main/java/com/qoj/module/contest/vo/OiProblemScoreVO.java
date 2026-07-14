package com.qoj.module.contest.vo;

/**
 * Oi题目分数响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record OiProblemScoreVO(
    Long contestProblemId,
    String label,
    Integer bestScore,
    Integer fullScore,
    Integer submissionCount
) {
}
