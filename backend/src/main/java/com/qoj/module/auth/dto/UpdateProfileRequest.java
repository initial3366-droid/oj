package com.qoj.module.auth.dto;

import jakarta.validation.constraints.Size;

/**
 * Update资料请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record UpdateProfileRequest(
    @Size(min = 3, max = 15, message = "用户名长度必须在3-15之间") String username,
    @Size(max = 80, message = "显示名称长度不能超过80") String displayName,
    @Size(max = 20, message = "邮箱验证码长度不能超过20") String emailVerificationCode
) {
}
