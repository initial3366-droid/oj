package com.qoj.module.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 登录请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record LoginRequest(
    @NotBlank String username,
    @NotBlank String password,
    String captchaId,
    String captcha
) {
}
