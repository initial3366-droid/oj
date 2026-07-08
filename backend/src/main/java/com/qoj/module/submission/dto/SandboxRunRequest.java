package com.qoj.module.submission.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SandboxRunRequest(
    @NotBlank @Size(max = 65536) String code,
    @NotBlank @Size(max = 64) String language,
    @Size(max = 65536) String input
) {
}
