package com.qoj.module.problem.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ProblemDraftBasicRequest(
    @NotBlank @Size(max = 200) String title,
    @NotNull @Min(100) Integer timeLimit,
    @NotNull @Min(16) Integer memoryLimit,
    @NotBlank String statement,
    String inputFormat,
    String outputFormat,
    List<String> tags,
    @Min(value = 1, message = "难度不能小于1") @Max(value = 5, message = "难度不能大于5") Integer difficulty,
    Long folderId,
    Boolean isPublic,
    @Valid List<ProblemSampleCaseRequest> samples
) {
}
