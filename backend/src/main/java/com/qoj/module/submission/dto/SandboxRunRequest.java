package com.qoj.module.submission.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SandboxRunRequest(
    @NotBlank @Size(max = 65536) String code,
    @NotBlank String language,
    String input
) {
}
