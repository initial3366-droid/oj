package com.qoj.module.practice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record PracticePublicationRequest(
    String title,
    String description,
    @NotBlank String studentAccessMode,
    List<Long> classIds,
    String password,
    @NotEmpty @Valid List<ProblemVisibilityRequest> problems
) {
    public record ProblemVisibilityRequest(
        Long problemId,
        @NotBlank String visibility
    ) {
    }
}
