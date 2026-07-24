package com.qoj.module.problem.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 题目DraftTestCases请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ProblemDraftTestCasesRequest(
    @NotEmpty(message = "请至少添加一个测试点") @Valid List<ProblemTestCaseRequest> testCases
) {
}
