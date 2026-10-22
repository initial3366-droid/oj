package com.qoj.module.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminUpdateProfileRequest(
    @NotBlank @Size(min = 3, max = 15) String username,
    @NotBlank @Size(max = 80) String displayName,
    @Email @Size(max = 100) String email
) {
}
