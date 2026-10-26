package com.qoj.module.problem.vo;

/** Hidden case metadata; large data is fetched only when a case is opened. */
public record ProblemTestCaseSummaryVO(
    Long id, Integer caseNo, Long inputBytes, Long outputBytes, Long publicInputBytes
) {
}
