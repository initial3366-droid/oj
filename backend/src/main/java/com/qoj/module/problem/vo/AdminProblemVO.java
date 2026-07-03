package com.qoj.module.problem.vo;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Admin problem view object for administrators.
 * Contains all fields including internal configuration and management fields.
 */
public record AdminProblemVO(
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
    String attemptStatus,
    // Admin-only fields
    Long ownerId,
    Boolean isPublic,
    String domjudgeProblemId,
    LocalDateTime updatedAt
) {
    /**
     * Converts this admin VO to a public VO by excluding admin-only fields.
     */
    public PublicProblemVO toPublicVO() {
        return new PublicProblemVO(
            id,
            title,
            statement,
            inputFormat,
            outputFormat,
            sampleCases,
            timeLimit,
            memoryLimit,
            difficulty,
            tags,
            folderId,
            folderName,
            acRate,
            createdAt,
            samples,
            testCaseCount,
            ownerName,
            attemptStatus
        );
    }
}
