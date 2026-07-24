package com.qoj.module.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * BindEmail请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record BindEmailRequest(
    @NotBlank(message = "邮箱不能为空") @Email(message = "邮箱格式不正确") @Size(max = 160, message = "邮箱长度不能超过160") String email,
    @NotBlank(message = "邮箱验证码不能为空") @Size(max = 20, message = "邮箱验证码长度不能超过20") String emailVerificationCode
) {
}
