package com.qoj.module.problem.vo;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Public problem view object for regular users.
 * Contains only publicly visible information, excluding internal fields.
 */
public record PublicProblemVO(
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
    Long folderId,
    String folderName,
    BigDecimal acRate,
    LocalDateTime createdAt,
    List<ProblemSampleCaseVO> samples,
    Long testCaseCount,
    String ownerName,
    String attemptStatus
) {
}
