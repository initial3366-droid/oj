package com.qoj.module.contest.dto;

import jakarta.validation.constraints.NotNull;

public record ContestProblemCaseScoreRequest(
    @NotNull Integer caseNo,
    @NotNull Integer score
) {
}
