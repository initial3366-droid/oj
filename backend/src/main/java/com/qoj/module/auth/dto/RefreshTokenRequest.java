package com.qoj.module.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Refresh令牌请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record RefreshTokenRequest(@NotBlank String refreshToken) {
}
