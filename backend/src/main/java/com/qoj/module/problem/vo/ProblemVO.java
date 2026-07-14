package com.qoj.module.problem.vo;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * @deprecated Use {@link PublicProblemVO} for regular users or {@link AdminProblemVO} for administrators.
 * This class is kept for backward compatibility and will be removed in a future version.
 */
@Deprecated(since = "2026-06-13", forRemoval = true)
public record ProblemVO(
    Long id,
    String title,
    String statement,
    String inputFormat,
    String outputFormat,
    String sampleCases,
    Integer timeLimit,
    Integer memoryLimit,
    Integer difficulty,
    List<String> tags,
    Long ownerId,
    Boolean isPublic,
    BigDecimal acRate,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    List<ProblemSampleCaseVO> samples,
    Long testCaseCount,
    String ownerName,
    String attemptStatus
) {
}
