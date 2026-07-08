package com.qoj.module.contest.dto;

import com.qoj.common.enums.AudienceType;
import com.qoj.common.enums.ContestStatus;
import com.qoj.common.enums.ContestType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ContestUpdateRequest(
    String title,
    String description,
    Integer durationMinutes,
    LocalDateTime startTime,
    LocalDateTime endTime,
    ContestType type,
    AudienceType audience,
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
    Boolean allowAfterEndViewCode,
    Boolean publicScoreboardEnabled,
    Boolean showClassOnScoreboard,
    Boolean allowStarRegistration,
    Boolean allowViewAllSubmissions,
    String registrationType,
    String registrationPassword,
    ContestStatus status,
    List<ContestProblemRequest> problems
) {
}
