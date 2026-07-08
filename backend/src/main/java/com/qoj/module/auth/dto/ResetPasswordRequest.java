package com.qoj.module.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
    @NotBlank(message = "邮箱不能为空") @Email(message = "邮箱格式不正确") @Size(max = 160, message = "邮箱长度不能超过160") String email,
    @NotBlank(message = "邮箱验证码不能为空") @Size(max = 20, message = "邮箱验证码长度不能超过20") String emailVerificationCode,
    @NotBlank(message = "新密码不能为空") @Size(min = 6, max = 20, message = "新密码长度必须在6-20之间") String newPassword
) {
}
