package com.qoj.module.problem.vo;

/**
 * 题目Test测试点响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ProblemTestCaseVO(
    Long id,
    Integer caseNo,
    String input,
    String output,
    String explanation,
    Boolean sample
) {
}
