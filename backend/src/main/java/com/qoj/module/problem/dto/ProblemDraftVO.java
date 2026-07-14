package com.qoj.module.problem.dto;

import java.util.List;

/**
 * 题目Draft请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ProblemDraftVO(
    String draftId,
    ProblemDraftBasicRequest basic,
    List<ProblemTestCaseRequest> testCases
) {
}
