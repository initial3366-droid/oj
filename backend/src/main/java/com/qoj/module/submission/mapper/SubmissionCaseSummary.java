package com.qoj.module.submission.mapper;

/** Database projection for submission lists; excludes test output and judge messages. */
public record SubmissionCaseSummary(
    Long submissionId,
    long totalCaseCount,
    long passedCaseCount,
    Integer maxTimeUsed,
    Integer maxMemoryUsed
) {
}
