package com.qoj.module.user.dto;

import com.qoj.common.enums.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 用户Create请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record UserCreateRequest(
    @NotBlank @Size(max = 80) String username,
    @NotBlank @Size(min = 6, max = 80) String password,
    @NotBlank @Size(max = 80) String displayName,
    @Size(max = 80) String studentNo,
    @Size(max = 160) String email,
    @NotNull UserRole role
) {
}
