package com.qoj.module.contest.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 管理端添加比赛报名人员请求。
 */
public record ContestRegistrationManageRequest(
    @NotNull Long userId,
    Boolean starred
) {
}
