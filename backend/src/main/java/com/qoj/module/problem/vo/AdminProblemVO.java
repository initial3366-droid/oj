package com.qoj.module.problem.vo;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.qoj.module.problem.dto.CommunicationConfig;
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
    Long submissionCount,
    Long acceptedCount,
    LocalDateTime createdAt,
    List<ProblemSampleCaseVO> samples,
    Long testCaseCount,
    String ownerName,
    String attemptStatus,
    // Admin-only fields
    Long ownerId,
    Boolean isPublic,
    LocalDateTime updatedAt,
    String ownerAccountType,
    String accessScope,
    Long majorId,
    String majorName,
    String studentPublishStatus,
    Boolean owner,
    Boolean canEdit,
    Boolean specialJudge,
    CommunicationConfig.Info communication
) {
    public AdminProblemVO(Long id, String title, String statement, String inputFormat, String outputFormat, String sampleCases, Integer timeLimit, Integer memoryLimit, Integer difficulty, List<String> tags, Long folderId, String folderName, BigDecimal acRate, Long submissionCount, Long acceptedCount, LocalDateTime createdAt, List<ProblemSampleCaseVO> samples, Long testCaseCount, String ownerName, String attemptStatus, Long ownerId, Boolean isPublic, LocalDateTime updatedAt, String ownerAccountType, String accessScope, Long majorId, String majorName, String studentPublishStatus, Boolean owner, Boolean canEdit, Boolean specialJudge) {
        this(id, title, statement, inputFormat, outputFormat, sampleCases, timeLimit, memoryLimit, difficulty, tags, folderId, folderName, acRate, submissionCount, acceptedCount, createdAt, samples, testCaseCount, ownerName, attemptStatus, ownerId, isPublic, updatedAt, ownerAccountType, accessScope, majorId, majorName, studentPublishStatus, owner, canEdit, specialJudge, null);
    }

    public AdminProblemVO withCommunication(CommunicationConfig.Info value) {
        return new AdminProblemVO(id, title, statement, inputFormat, outputFormat, sampleCases, timeLimit, memoryLimit, difficulty, tags, folderId, folderName, acRate, submissionCount, acceptedCount, createdAt, samples, testCaseCount, ownerName, attemptStatus, ownerId, isPublic, updatedAt, ownerAccountType, accessScope, majorId, majorName, studentPublishStatus, owner, canEdit, specialJudge, value);
    }

    @JsonProperty("judgeMode")
    public String judgeMode() {
        return communication != null ? "COMMUNICATION" : Boolean.TRUE.equals(specialJudge) ? "SPECIAL" : "STANDARD";
    }

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
            attemptStatus,
            specialJudge
        ).withCommunication(communication);
    }
}
