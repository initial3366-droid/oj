package com.qoj.module.leaderboard.vo;

/**
 * 用户排名响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record UserRankVO(
    Long userId,
    String name,
    String avatarUrl,
    String className,
    Integer acCount,
    Integer streak,
    Integer weekAcCount,
    Long rank
) {
}
