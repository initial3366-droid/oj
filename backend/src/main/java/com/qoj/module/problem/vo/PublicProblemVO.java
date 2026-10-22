package com.qoj.module.problem.vo;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.qoj.module.problem.dto.CommunicationConfig;
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
    String attemptStatus,
    Boolean specialJudge,
    CommunicationConfig.Info communication
) {
    public PublicProblemVO(Long id, String title, String statement, String inputFormat, String outputFormat, String sampleCases, Integer timeLimit, Integer memoryLimit, Integer difficulty, List<String> tags, Long folderId, String folderName, BigDecimal acRate, LocalDateTime createdAt, List<ProblemSampleCaseVO> samples, Long testCaseCount, String ownerName, String attemptStatus, Boolean specialJudge) {
        this(id, title, statement, inputFormat, outputFormat, sampleCases, timeLimit, memoryLimit, difficulty, tags, folderId, folderName, acRate, createdAt, samples, testCaseCount, ownerName, attemptStatus, specialJudge, null);
    }

    public PublicProblemVO withCommunication(CommunicationConfig.Info value) {
        return new PublicProblemVO(id, title, statement, inputFormat, outputFormat, sampleCases, timeLimit, memoryLimit, difficulty, tags, folderId, folderName, acRate, createdAt, samples, testCaseCount, ownerName, attemptStatus, specialJudge, value);
    }

    @JsonProperty("judgeMode")
    public String judgeMode() {
        return communication != null ? "COMMUNICATION" : Boolean.TRUE.equals(specialJudge) ? "SPECIAL" : "STANDARD";
    }

}
