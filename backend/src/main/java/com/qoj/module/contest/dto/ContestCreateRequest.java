package com.qoj.module.contest.dto;

import com.qoj.common.enums.AudienceType;
import com.qoj.common.enums.ContestType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 比赛Create请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
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
    Boolean allowAfterEndSubmit,
    Boolean allowAfterEndViewProblem,
    Boolean allowAfterEndViewCode,
    Boolean enableCodeTemplates,
    Boolean publicScoreboardEnabled,
    Boolean showClassOnScoreboard,
    Boolean allowStarRegistration,
    Boolean allowViewAllSubmissions,
    String registrationType,
    String registrationPassword,
    List<ContestProblemRequest> problems,
    String allowedIpRanges,
    Boolean hidden,
    Boolean scoreboardEnabled,
    Boolean resultsPublished
) {
    public ContestCreateRequest(
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
    Boolean allowAfterEndSubmit,
    Boolean allowAfterEndViewProblem,
    Boolean allowAfterEndViewCode,
    Boolean enableCodeTemplates,
    Boolean publicScoreboardEnabled,
    Boolean showClassOnScoreboard,
    Boolean allowStarRegistration,
    Boolean allowViewAllSubmissions,
    String registrationType,
    String registrationPassword,
    List<ContestProblemRequest> problems,
    String allowedIpRanges
    ) {
        this(title, description, durationMinutes, startTime, endTime, type, audience, audienceId, audiences, frozen, freezeTime, enableRollingScoreboard, goldRatio, silverRatio, bronzeRatio, allowAfterEndSubmit, allowAfterEndViewProblem, allowAfterEndViewCode, enableCodeTemplates, publicScoreboardEnabled, showClassOnScoreboard, allowStarRegistration, allowViewAllSubmissions, registrationType, registrationPassword, problems, allowedIpRanges, null);
    }

    public ContestCreateRequest(
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
        Boolean allowAfterEndSubmit,
        Boolean allowAfterEndViewProblem,
        Boolean allowAfterEndViewCode,
        Boolean enableCodeTemplates,
        Boolean publicScoreboardEnabled,
        Boolean showClassOnScoreboard,
        Boolean allowStarRegistration,
        Boolean allowViewAllSubmissions,
        String registrationType,
        String registrationPassword,
        List<ContestProblemRequest> problems,
        String allowedIpRanges,
        Boolean hidden
    ) {
        this(title, description, durationMinutes, startTime, endTime, type, audience, audienceId, audiences,
            frozen, freezeTime, enableRollingScoreboard, goldRatio, silverRatio, bronzeRatio,
            allowAfterEndSubmit, allowAfterEndViewProblem, allowAfterEndViewCode, enableCodeTemplates,
            publicScoreboardEnabled, showClassOnScoreboard, allowStarRegistration, allowViewAllSubmissions,
            registrationType, registrationPassword, problems, allowedIpRanges, hidden, null, null);
    }
}
