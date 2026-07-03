package com.qoj.module.submission.vo;

public record SubmissionCaseVO(
    Long id,
    Long submissionId,
    Integer caseNo,
    Integer subtaskNo,
    String status,
    Integer score,
    Integer maxScore,
    Integer timeMs,
    Integer memoryKb,
    String inputPreview,
    String outputPreview,
    String expectedPreview,
    String judgeMessage
) {
}
