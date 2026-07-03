package com.qoj.module.contest.dto;

import com.qoj.common.enums.AudienceType;
import com.qoj.common.enums.ContestType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ContestCreateRequest(
    @NotBlank String title,
    String description,
    Integer durationMinutes,
    @NotNull LocalDateTime startTime,
    @NotNull LocalDateTime endTime,
    @NotNull ContestType type,
    @NotNull AudienceType audience,
    Long audienceId,
    List<ContestAudienceRequest> audiences,
    Boolean frozen,
    LocalDateTime freezeTime,
    Boolean enableRollingScoreboard,
    BigDecimal goldRatio,
    BigDecimal silverRatio,
    BigDecimal bronzeRatio,
    Boolean allowFullscreen,
    Boolean antiCheatEnabled,
    Integer maxSwitches,
    Boolean allowAfterEndSubmit,
    Boolean allowAfterEndViewProblem,
    Boolean publicScoreboardEnabled,
    Boolean allowStarRegistration,
    String registrationType,
    String registrationPassword,
    List<ContestProblemRequest> problems
) {
}
