package com.qoj.module.contest.dto;

import com.qoj.common.enums.AudienceType;
import jakarta.validation.constraints.NotNull;

/**
 * 比赛Audience请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ContestAudienceRequest(
    @NotNull AudienceType audienceType,
    Long audienceId
) {
}
