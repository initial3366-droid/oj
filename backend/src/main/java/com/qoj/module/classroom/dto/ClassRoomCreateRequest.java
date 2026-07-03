package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ClassRoomCreateRequest(
    @NotBlank @Size(max = 120) String name,
    @Size(max = 2000) String description,
    Long teacherId,
    Boolean joinEnabled,
    Boolean approvalRequired
) {
}
