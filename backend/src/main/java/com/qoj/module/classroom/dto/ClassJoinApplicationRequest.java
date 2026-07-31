package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.Size;

/**
 * 班级JoinApplication请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClassJoinApplicationRequest(
    @Size(max = 500) String reason
) {
}
