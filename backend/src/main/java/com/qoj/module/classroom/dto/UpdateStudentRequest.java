package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.Size;

/**
 * UpdateStudent请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record UpdateStudentRequest(
    @Size(max = 50) String displayName,
    @Size(max = 50) String studentNo,
    @Size(max = 100) String email,
    @Size(min = 6, max = 64) String password
) {
}
