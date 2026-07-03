package com.qoj.module.judge;

import java.util.List;

/**
 * 判题任务
 */
public record JudgeTask(
    Long submissionId,
    String language,
    String code,
    Integer timeLimit,      // ms
    Integer memoryLimit,    // MB
    List<TestCase> testCases
) {
    public record TestCase(
        Integer caseNo,
        String input,
        String expectedOutput
    ) {}
}
