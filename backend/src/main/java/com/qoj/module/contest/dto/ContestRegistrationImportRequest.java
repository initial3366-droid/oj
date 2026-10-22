package com.qoj.module.contest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ContestRegistrationImportRequest(
    @NotEmpty @Size(max = 5000) List<@NotBlank @Size(max = 80) String> studentNos
) {}
