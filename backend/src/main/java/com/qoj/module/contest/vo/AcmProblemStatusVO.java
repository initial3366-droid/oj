package com.qoj.module.contest.vo;

public record AcmProblemStatusVO(
    Long contestProblemId,
    String label,
    Boolean isSolved,
    Integer wrongAttempts,
    Integer solveTimeMinutes
) {
}
