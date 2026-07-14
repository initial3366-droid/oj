package com.qoj.module.contest.dto;

import com.qoj.common.enums.IdentityType;

/**
 * 比赛注册请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ContestRegisterRequest(
    IdentityType identityType,
    Long identityId,
    Boolean starred,
    String password
) {
}
