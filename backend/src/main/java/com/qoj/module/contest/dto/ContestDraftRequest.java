package com.qoj.module.contest.dto;

import com.qoj.common.enums.AudienceType;
import com.qoj.common.enums.ContestType;
import java.math.BigDecimal;
import java.util.List;

public record ContestDraftRequest(
    String title,
    Integer durationMinutes,
    String startTime,
    String description,
    ContestType type,
    AudienceType audience,
    List<AudienceType> audienceTypes,
    List<Long> clubIds,
    Boolean frozen,
    String freezeTime,
    Boolean enableRollingScoreboard,
    BigDecimal goldRatio,
    BigDecimal silverRatio,
    BigDecimal bronzeRatio,
    Boolean allowAfterEndSubmit,
    Boolean allowAfterEndViewProblem,
    Boolean publicScoreboardEnabled,
    String registrationPassword,
    Integer totalScore,
    List<ContestProblemRequest> problems
) {
}
