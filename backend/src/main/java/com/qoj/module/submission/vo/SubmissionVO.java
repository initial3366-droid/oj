package com.qoj.module.submission.vo;

import java.time.LocalDateTime;
import java.util.List;

public record SubmissionVO(
    Long id,
    Long userId,
    Long problemId,
    String problemTitle,
    Long contestId,
    Long practiceId,
    String language,
    String status,
    Integer timeUsed,
    Integer memoryUsed,
    String identityType,
    Long identityId,
    String domjudgeSubmissionId,
    LocalDateTime submitTime,
    LocalDateTime createdAt,
    Integer passedCaseCount,
    Integer totalCaseCount,
    String code,
    List<SubmissionCaseVO> cases
) {
}
