package com.qoj.module.admin.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminUpdateProfileRequest(
    @NotBlank(message = "显示名称不能为空")
    @Size(max = 80, message = "显示名称长度不能超过80")
    String displayName,

    @Email(message = "邮箱格式不正确")
    @Size(max = 160, message = "邮箱长度不能超过160")
    String email
) {
}
