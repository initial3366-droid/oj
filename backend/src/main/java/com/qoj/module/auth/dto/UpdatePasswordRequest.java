package com.qoj.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * UpdatePassword请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record UpdatePasswordRequest(
    @NotBlank(message = "旧密码不能为空") String oldPassword,
    @NotBlank(message = "新密码不能为空") @Size(min = 6, max = 20, message = "新密码长度必须在6-20之间") String newPassword
) {
}
