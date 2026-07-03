package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

public record StudentImportRequest(
    @NotNull Long classId,
    @NotBlank String studentNoField,
    @NotBlank String nameField,
    List<String> fields,
    @NotEmpty List<Map<String, String>> rows
) {
}
