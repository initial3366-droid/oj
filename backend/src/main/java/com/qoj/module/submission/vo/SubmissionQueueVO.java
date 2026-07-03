package com.qoj.module.submission.vo;

import java.time.LocalDateTime;

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
