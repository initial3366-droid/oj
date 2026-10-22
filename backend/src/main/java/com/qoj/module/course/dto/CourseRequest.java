package com.qoj.module.course.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CourseRequest(
    @NotBlank @Size(max = 200) String title,
    @Size(max = 10000) String description,
    @Size(max = 100) String term,
    Long classId,
    @NotBlank String status,
    @Size(max = 200) List<@NotNull Long> classIds
) {}
