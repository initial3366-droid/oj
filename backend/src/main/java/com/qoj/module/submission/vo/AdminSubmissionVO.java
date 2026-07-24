package com.qoj.module.submission.vo;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 管理员提交响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record AdminSubmissionVO(
    Long id,
    Long userId,
    String username,
    String displayName,
    Long problemId,
    String problemTitle,
    Long contestId,
    String contestTitle,
    Long contestProblemId,
    String contestProblemLabel,
    Long practiceId,
    String practiceTitle,
    Long participantId,
    Long teamId,
    Integer codeLength,
    String language,
    String status,
    Integer score,
    Integer timeUsed,
    Integer memoryUsed,
    String identityType,
    Long identityId,
    String judgeServer,
    Integer priority,
    Integer retryCount,
    String judgeMessage,
    String errorMessage,
    LocalDateTime submitTime,
    LocalDateTime judgeStartTime,
    LocalDateTime judgeEndTime,
    Boolean isContestSubmission,
    Boolean isFrozen,
    Boolean isRejudged,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    Integer passedCaseCount,
    Integer totalCaseCount,
    String code,
    List<SubmissionCaseVO> cases
) {
}
