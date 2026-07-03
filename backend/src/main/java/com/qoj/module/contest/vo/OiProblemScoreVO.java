package com.qoj.module.contest.vo;

public record OiProblemScoreVO(
    Long contestProblemId,
    String label,
    Integer bestScore,
    Integer fullScore,
    Integer submissionCount
) {
}
