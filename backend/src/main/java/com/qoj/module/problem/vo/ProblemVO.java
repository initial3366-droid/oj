package com.qoj.module.problem.vo;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.qoj.module.problem.dto.CommunicationConfig;
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
    String attemptStatus,
    Boolean specialJudge,
    CommunicationConfig.Info communication
) {
    public ProblemVO(Long id, String title, String statement, String inputFormat, String outputFormat, String sampleCases, Integer timeLimit, Integer memoryLimit, Integer difficulty, List<String> tags, Long ownerId, Boolean isPublic, BigDecimal acRate, LocalDateTime createdAt, LocalDateTime updatedAt, List<ProblemSampleCaseVO> samples, Long testCaseCount, String ownerName, String attemptStatus, Boolean specialJudge) {
        this(id, title, statement, inputFormat, outputFormat, sampleCases, timeLimit, memoryLimit, difficulty, tags, ownerId, isPublic, acRate, createdAt, updatedAt, samples, testCaseCount, ownerName, attemptStatus, specialJudge, null);
    }

    public ProblemVO withCommunication(CommunicationConfig.Info value) {
        return new ProblemVO(id, title, statement, inputFormat, outputFormat, sampleCases, timeLimit, memoryLimit, difficulty, tags, ownerId, isPublic, acRate, createdAt, updatedAt, samples, testCaseCount, ownerName, attemptStatus, specialJudge, value);
    }

    @JsonProperty("judgeMode")
    public String judgeMode() {
        return communication != null ? "COMMUNICATION" : Boolean.TRUE.equals(specialJudge) ? "SPECIAL" : "STANDARD";
    }

}
