package com.qoj.module.problem.dto;

import jakarta.validation.constraints.NotBlank;

public record ProblemTestCaseRequest(
    Integer caseNo,
    @NotBlank String input,
    @NotBlank String output
) {
}
