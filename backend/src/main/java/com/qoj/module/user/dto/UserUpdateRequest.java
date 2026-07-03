package com.qoj.module.user.dto;

import com.qoj.common.enums.UserRole;
import jakarta.validation.constraints.Size;

public record UserUpdateRequest(
    @Size(max = 80) String username,
    @Size(min = 6, max = 80) String password,
    @Size(max = 80) String displayName,
    @Size(max = 80) String studentNo,
    @Size(max = 160) String email,
    UserRole role
) {
}
