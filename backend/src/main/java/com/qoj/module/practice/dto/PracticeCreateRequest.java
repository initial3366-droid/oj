package com.qoj.module.practice.dto;

import com.qoj.common.enums.AudienceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record PracticeCreateRequest(
    @NotBlank String title,
    String description,
    AudienceType audience,
    Long audienceId,
    String password,
    @NotEmpty List<Long> problemIds
) {
}
