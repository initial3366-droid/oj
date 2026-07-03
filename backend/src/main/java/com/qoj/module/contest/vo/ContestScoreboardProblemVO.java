package com.qoj.module.contest.vo;

public record ContestScoreboardProblemVO(
    Long problemId,
    String label,
    String title,
    Integer score
) {
}
