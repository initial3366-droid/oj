package com.qoj.module.submission.vo;

import java.time.LocalDateTime;

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
