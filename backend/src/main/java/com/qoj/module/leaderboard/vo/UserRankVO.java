package com.qoj.module.leaderboard.vo;

public record UserRankVO(
    Long userId,
    String name,
    String className,
    Integer acCount,
    Integer streak,
    Integer weekAcCount,
    Long rank
) {
}
