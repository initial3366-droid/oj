package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.Size;

public record TeacherUpdateRequest(
    @Size(max = 80) String username,
    @Size(min = 6, max = 80) String password,
    @Size(max = 80) String displayName,
    @Size(max = 80) String studentNo,
    @Size(max = 160) String email
) {
}
