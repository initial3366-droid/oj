package com.qoj.module.contest.dto;

import com.qoj.common.enums.AudienceType;
import com.qoj.common.enums.ContestType;
import com.qoj.common.enums.JudgeBackend;
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
    JudgeBackend judgeMode,
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
    Boolean allowAfterEndViewCode,
    Boolean publicScoreboardEnabled,
    Boolean showClassOnScoreboard,
    Boolean allowStarRegistration,
    Boolean allowViewAllSubmissions,
    String registrationType,
    String registrationPassword,
    List<ContestProblemRequest> problems
) {
}
