package com.qoj.module.problem.vo;

public record ProblemTestCaseVO(
    Long id,
    Integer caseNo,
    String input,
    String output,
    String explanation,
    Boolean sample
) {
}
