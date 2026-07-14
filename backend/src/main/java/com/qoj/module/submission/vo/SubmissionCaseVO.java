package com.qoj.module.submission.vo;

/**
 * 提交测试点响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
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
