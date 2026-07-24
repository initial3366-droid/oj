package com.qoj.module.submission.vo;

import java.time.LocalDateTime;

/**
 * 提交队列Log响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record SubmissionQueueLogVO(
    Long queueId,
    Long submissionId,
    String status,
    String judgeServer,
    String judgeMessage,
    String errorMessage,
    LocalDateTime submitTime,
    LocalDateTime startJudgeTime,
    LocalDateTime finishTime
) {
}
