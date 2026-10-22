package com.qoj.module.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record StudentBatchRequest(
    @NotEmpty @Size(max = 500) List<@NotNull @Positive Long> userIds,
    @NotBlank String action,
    @Positive Long classId,
    @Size(max = 72) String password,
    @Size(max = 128) String adminPassword
) {}
