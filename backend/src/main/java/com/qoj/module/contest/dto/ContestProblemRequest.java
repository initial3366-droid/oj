package com.qoj.module.contest.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public record ContestProblemRequest(
    @NotNull Long problemId,
    @NotNull String label,
    Integer score,
    Integer displayOrder,
    List<ContestProblemCaseScoreRequest> caseScores
) {
}
