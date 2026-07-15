package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.Size;

/**
 * 教师Update请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record TeacherUpdateRequest(
    @Size(max = 80) String username,
    @Size(min = 6, max = 80) String password,
    @Size(max = 80) String displayName,
    @Size(max = 80) String teacherNo,
    @Size(max = 160) String email,
    Long majorId,
    String status
) {
}
