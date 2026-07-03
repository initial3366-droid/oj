package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.Size;

public record ClassRoomUpdateRequest(
    @Size(max = 120) String name,
    @Size(max = 2000) String description,
    Long teacherId,
    Boolean joinEnabled,
    Boolean approvalRequired
) {
}
