package com.qoj.module.setting.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * PasswordChange请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public class PasswordChangeRequest {
    @NotBlank(message = "旧密码不能为空")
    public String oldPassword;

    @NotBlank(message = "新密码不能为空")
    @Size(min = 6, max = 32, message = "密码长度必须在6-32个字符之间")
    public String newPassword;
}
