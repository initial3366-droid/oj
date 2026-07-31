package com.qoj.module.practice.vo;

/**
 * 练习排名响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record PracticeRankVO(
    Long userId,
    String displayName,
    Integer score,
    Integer solved,
    Integer submissionCount
) {
}
