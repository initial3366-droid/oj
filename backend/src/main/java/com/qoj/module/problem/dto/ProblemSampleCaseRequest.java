package com.qoj.module.problem.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 题目Sample测试点请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ProblemSampleCaseRequest(
    @NotNull(message = "样例输入字段不能缺失") String input,
    @NotNull(message = "样例输出字段不能缺失") String output,
    String explanation
) {
}
