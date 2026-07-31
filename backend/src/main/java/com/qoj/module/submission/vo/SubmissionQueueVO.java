package com.qoj.module.submission.vo;

import java.time.LocalDateTime;

/**
 * 提交队列响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record SubmissionQueueVO(
    Long queueId,
    Long submissionId,
    Long contestId,
    String contestTitle,
    Long problemId,
    Long contestProblemId,
    String problemLabel,
    String problemTitle,
    Long userId,
    String username,
    String displayName,
    String language,
    String status,
    String statusText,
    String judgeServer,
    Integer priority,
    LocalDateTime submitTime,
    LocalDateTime startJudgeTime,
    LocalDateTime finishTime,
    Long waitingTimeMillis,
    Long runningTimeMillis,
    Integer retryCount,
    String errorMessage
) {
}
