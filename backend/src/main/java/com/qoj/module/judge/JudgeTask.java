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
    /**
     * Test测试点不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    public record TestCase(
        Integer caseNo,
        String input,
        String expectedOutput
    ) {}
}
