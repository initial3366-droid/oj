package com.qoj.module.practice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.time.LocalDateTime;
import java.util.List;

public record PracticePublicationRequest(
    String title,
    String description,
    @NotBlank String studentAccessMode,
    List<Long> classIds,
    String password,
    @NotEmpty @Valid List<ProblemVisibilityRequest> problems,
    Long courseId,
    @Min(1) Integer displayOrder,
    LocalDateTime startTime,
    LocalDateTime endTime
) {
    public PracticePublicationRequest(String title, String description, String studentAccessMode,
        List<Long> classIds, String password, List<ProblemVisibilityRequest> problems) {
        this(title, description, studentAccessMode, classIds, password, problems, null, null, null, null);
    }

    public record ProblemVisibilityRequest(
        Long problemId,
        @NotBlank String visibility
    ) {
    }
}
