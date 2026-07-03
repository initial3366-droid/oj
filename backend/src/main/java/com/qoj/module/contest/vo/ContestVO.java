package com.qoj.module.contest.vo;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ContestVO(
    Long id,
    String title,
    String description,
    Integer durationMinutes,
    LocalDateTime startTime,
    LocalDateTime endTime,
    String type,
    Long ownerId,
    String ownerName,
    String audience,
    Long audienceId,
    List<ContestAudienceVO> audiences,
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
    Boolean hasPassword,
    String status,
    Long registrationCount,
    Long participantCount,
    Long submissionCount,
    List<ContestProblemVO> problems,
    Boolean registered,
    String registeredIdentityType,
    Long registeredIdentityId,
    String registeredIdentityName,
    Boolean registeredStarred
) {
}
