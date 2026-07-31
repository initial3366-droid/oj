package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

/**
 * StudentImport请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record StudentImportRequest(
    @NotNull Long classId,
    @NotBlank String studentNoField,
    @NotBlank String nameField,
    List<String> fields,
    @NotEmpty List<Map<String, String>> rows
) {
}
