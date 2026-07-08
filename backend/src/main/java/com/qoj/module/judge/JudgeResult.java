package com.qoj.module.judge;

import com.qoj.common.enums.SubmissionStatus;
import java.util.List;

/**
 * 判题结果
 */
public record JudgeResult(
    SubmissionStatus status,
    String compileOutput,
    Integer maxTimeMs,
    Integer maxMemoryKb,
    List<JudgeCaseResult> caseResults
) {
    public static JudgeResult compileError(String compileOutput) {
        return new JudgeResult(SubmissionStatus.CE, compileOutput, 0, null, List.of());
    }

    public static JudgeResult systemError(String message) {
        return new JudgeResult(SubmissionStatus.SE, message, 0, null, List.of());
    }
}
