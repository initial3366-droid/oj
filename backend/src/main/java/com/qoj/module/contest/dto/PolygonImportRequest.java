package com.qoj.module.contest.dto;

import com.qoj.common.enums.ContestType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public record PolygonImportRequest(
    @Size(max = 200) String title,
    @NotNull LocalDateTime startTime,
    @NotNull @Min(1) @Max(10080) Integer durationMinutes,
    @NotNull ContestType type
) {}
