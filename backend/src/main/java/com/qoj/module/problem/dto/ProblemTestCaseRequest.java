package com.qoj.module.problem.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 题目Test测试点请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ProblemTestCaseRequest(
    Integer caseNo,
    @NotBlank String input,
    @NotBlank String output
) {
}
