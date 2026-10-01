package com.qojagent.api;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ProblemGenerateRequest(
    @Size(max = 80) String title,
    @NotBlank @Size(max = 20) String rating,
    @Size(max = 800) String background,
    @NotBlank @Size(max = 3000) String description,
    @NotEmpty @Size(max = 20) List<@NotBlank @Size(max = 80) String> knowledgePoints,
    @Min(5) @Max(200) int testCaseCount
) {}
