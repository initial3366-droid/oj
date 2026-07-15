package com.qoj.module.judge;

import com.qoj.common.enums.SubmissionStatus;

/**
 * 单个测试点结果
 */
public record JudgeCaseResult(
    Integer caseNo,
    SubmissionStatus status,
    Integer timeMs,
    Integer memoryKb,
    String inputPreview,
    String outputPreview,
    String expectedPreview,
    String message
) {}
