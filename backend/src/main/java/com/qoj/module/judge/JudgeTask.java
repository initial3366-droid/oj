package com.qoj.module.judge;

import com.qoj.module.problem.dto.CommunicationConfig;
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
    String checkerSource,
    List<TestCase> testCases,
    CommunicationConfig communication
) {
    public JudgeTask(Long submissionId, String language, String code, Integer timeLimit, Integer memoryLimit,
                     String checkerSource, List<TestCase> testCases) {
        this(submissionId, language, code, timeLimit, memoryLimit, checkerSource, testCases, null);
    }
    /**
     * Test测试点不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    public record TestCase(
        Integer caseNo,
        String input,
        String expectedOutput,
        String publicInput
    ) {
        public TestCase(Integer caseNo, String input, String expectedOutput) {
            this(caseNo, input, expectedOutput, "");
        }
    }
}
