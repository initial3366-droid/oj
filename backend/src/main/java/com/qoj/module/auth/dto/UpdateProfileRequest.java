package com.qoj.module.auth.dto;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
    @Size(min = 3, max = 15, message = "用户名长度必须在3-15之间") String username,
    @Size(max = 80, message = "显示名称长度不能超过80") String displayName,
    @Size(max = 20, message = "邮箱验证码长度不能超过20") String emailVerificationCode
) {
}
