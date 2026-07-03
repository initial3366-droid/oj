package com.qoj.module.problem.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record ProblemDraftTestCasesRequest(
    @NotEmpty @Valid List<ProblemTestCaseRequest> testCases
) {
}
