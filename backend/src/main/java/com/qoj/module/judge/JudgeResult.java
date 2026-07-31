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
    /**
     * 封装compileError相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static JudgeResult compileError(String compileOutput) {
        /**
         * 构造 判题结果 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new JudgeResult(SubmissionStatus.CE, compileOutput, 0, null, List.of());
    }

    /**
     * 封装systemError相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static JudgeResult systemError(String message) {
        /**
         * 构造 判题结果 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new JudgeResult(SubmissionStatus.SE, message, 0, null, List.of());
    }
}
