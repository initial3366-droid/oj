package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;

/**
 * 教师Create请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record TeacherCreateRequest(
    @NotBlank @Size(max = 80) String username,
    @NotBlank @Size(min = 6, max = 80) String password,
    @NotBlank @Size(max = 80) String displayName,
    @Size(max = 80) String teacherNo,
    @Size(max = 160) String email,
    @NotNull Long majorId
) {
}
