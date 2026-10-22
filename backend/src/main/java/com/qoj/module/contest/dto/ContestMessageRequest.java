package com.qoj.module.contest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record ContestMessageRequest(
    @NotBlank @Size(max = 2000) String content,
    @Positive Long participantId,
    @NotBlank @Pattern(regexp = "[a-fA-F0-9-]{36}") String requestId
) {}
