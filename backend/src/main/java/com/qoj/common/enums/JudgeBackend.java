package com.qoj.common.enums;

/**
 * Server-owned routing choice for a submission.
 *
 * <p>Clients may choose a backend only while an authorized owner configures a
 * contest. Submission requests never accept this value directly.
 */
public enum JudgeBackend {
    GO_JUDGE,
    CCPCOJ;

    /**
     * 封装比赛默认值相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static JudgeBackend contestDefault(JudgeBackend value) {
        return value == null ? GO_JUDGE : value;
    }

    /**
     * 封装fromStored相关逻辑。不满足业务约束时直接抛出明确异常。
     */
    public static JudgeBackend fromStored(String value, JudgeBackend fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            /**
             * 封装值Of相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            // Invalid persisted routing must stop dispatch instead of silently
            // moving an untrusted submission to a different execution service.
            throw new IllegalStateException("Unsupported stored judge backend", ex);
        }
    }
}
