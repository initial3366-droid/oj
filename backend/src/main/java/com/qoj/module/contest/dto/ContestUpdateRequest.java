package com.qoj.module.contest.dto;

import com.qoj.common.enums.AudienceType;
import com.qoj.common.enums.ContestStatus;
import com.qoj.common.enums.ContestType;
import com.qoj.common.enums.JudgeBackend;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 比赛Update请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ContestUpdateRequest(
    String title,
    String description,
    Integer durationMinutes,
    LocalDateTime startTime,
    LocalDateTime endTime,
    ContestType type,
    JudgeBackend judgeMode,
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
    Boolean enableCodeTemplates,
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
