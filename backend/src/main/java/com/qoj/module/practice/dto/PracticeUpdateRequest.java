package com.qoj.module.practice.dto;

import com.qoj.common.enums.AudienceType;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record PracticeUpdateRequest(
    @NotBlank String title,
    String description,
    AudienceType audience,
    Long audienceId,
    String password,
    List<Long> problemIds
) {}
