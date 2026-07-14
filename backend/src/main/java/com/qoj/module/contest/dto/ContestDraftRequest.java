package com.qoj.module.contest.dto;

import com.qoj.common.enums.AudienceType;
import com.qoj.common.enums.ContestType;
import com.qoj.common.enums.JudgeBackend;
import java.math.BigDecimal;
import java.util.List;

/**
 * 比赛Draft请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ContestDraftRequest(
    String title,
    Integer durationMinutes,
    String startTime,
    String description,
    ContestType type,
    JudgeBackend judgeMode,
    AudienceType audience,
    List<AudienceType> audienceTypes,
    List<Long> classIds,
    Boolean frozen,
    String freezeTime,
    Boolean enableRollingScoreboard,
    BigDecimal goldRatio,
    BigDecimal silverRatio,
    BigDecimal bronzeRatio,
    Boolean allowAfterEndSubmit,
    Boolean allowAfterEndViewProblem,
    Boolean allowAfterEndViewCode,
    Boolean publicScoreboardEnabled,
    Boolean showClassOnScoreboard,
    Boolean allowViewAllSubmissions,
    String registrationPassword,
    Integer totalScore,
    List<ContestProblemRequest> problems
) {
}
