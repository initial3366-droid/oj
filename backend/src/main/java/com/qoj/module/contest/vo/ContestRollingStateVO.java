package com.qoj.module.contest.vo;

import java.time.LocalDateTime;
import java.util.List;

public record ContestRollingStateVO(
    Long contestId,
    String status,
    Integer currentStep,
    Integer totalSteps,
    Boolean publishedFinal,
    List<ContestRollingStepVO> steps,
    LocalDateTime startedAt,
    LocalDateTime publishedAt,
    LocalDateTime updatedAt
) {
}
