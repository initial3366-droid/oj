package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.Size;

public record ClassJoinApplicationRequest(
    @Size(max = 500) String reason
) {
}
