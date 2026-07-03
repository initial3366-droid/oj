package com.qoj.module.leaderboard.vo;

public record RatingUserVO(
    Long userId,
    String name,
    String className,
    Integer acCount,
    Integer streak,
    Integer weekAcCount
) {
}
