package com.qoj.module.submission.vo;

import java.time.LocalDateTime;

/** Public list projection. Source code, case details and internal account associations are excluded. */
public record SubmissionListVO(
    Long id,
    Long userId,
    String displayName,
    Long problemId,
    String problemTitle,
    String language,
    String status,
    Integer timeUsed,
    Integer memoryUsed,
    LocalDateTime createdAt,
    Integer codeLength,
    Integer passedCaseCount,
    Integer totalCaseCount
) {
    public static SubmissionListVO from(SubmissionVO item, boolean masked) {
        return new SubmissionListVO(
            item.id(), item.userId(), item.displayName(), item.problemId(), item.problemTitle(), item.language(),
            masked ? "PENDING" : item.status(), masked ? null : item.timeUsed(), masked ? null : item.memoryUsed(),
            item.createdAt(), masked ? null : item.codeLength(), masked ? null : item.passedCaseCount(),
            masked ? null : item.totalCaseCount()
        );
    }
}
