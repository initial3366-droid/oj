package com.qoj.module.contest.vo;

/**
 * 比赛RollingStep响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ContestRollingStepVO(
    Integer step,
    String identityType,
    Long identityId,
    Long userId,
    String displayName,
    Integer frozenRank,
    Integer finalRank,
    Integer solved,
    Integer penalty,
    Integer score,
    String medal,
    Integer rankDelta
) {
}
