package com.qoj.module.contest.dto;

import com.qoj.common.enums.AudienceType;
import jakarta.validation.constraints.NotNull;

public record ContestAudienceRequest(
    @NotNull AudienceType audienceType,
    Long audienceId
) {
}
