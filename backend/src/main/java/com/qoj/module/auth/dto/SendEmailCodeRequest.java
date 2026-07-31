package com.qoj.module.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * SendEmail编码请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record SendEmailCodeRequest(
    @NotBlank @Email @Size(max = 160) String email,
    @NotBlank(message = "验证码ID不能为空") String captchaId,
    @NotBlank(message = "验证码不能为空") String captcha
) {
}
