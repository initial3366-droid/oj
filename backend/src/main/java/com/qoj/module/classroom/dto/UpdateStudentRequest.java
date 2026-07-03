package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.Size;

public record UpdateStudentRequest(
    @Size(max = 50) String displayName,
    @Size(max = 50) String studentNo,
    @Size(max = 100) String email,
    @Size(min = 6, max = 64) String password
) {
}
