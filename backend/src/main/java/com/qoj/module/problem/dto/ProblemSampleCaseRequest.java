package com.qoj.module.problem.dto;

import jakarta.validation.constraints.NotBlank;

public record ProblemSampleCaseRequest(
    @NotBlank String input,
    @NotBlank String output,
    String explanation
) {
}
