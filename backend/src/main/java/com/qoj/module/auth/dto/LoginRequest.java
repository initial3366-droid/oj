package com.qoj.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 登录请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record LoginRequest(
    @NotBlank String username,
    @NotBlank String password,
    @NotBlank(message = "请输入验证码") @Size(max = 128, message = "验证码标识过长") String captchaId,
    @NotBlank(message = "请输入验证码") @Size(max = 16, message = "验证码过长") String captcha,
    Boolean rememberMe
) {
    public LoginRequest(String username, String password, String captchaId, String captcha) {
        this(username, password, captchaId, captcha, false);
    }
}
