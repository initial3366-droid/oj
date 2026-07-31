package com.qoj.module.contest.vo;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 比赛Acm排名响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ContestAcmRankVO(
    Long participantId,
    Long userId,
    String nickname,
    String organizationName,
    Integer rankNo,
    Integer solvedCount,
    Integer penaltyTime,
    Integer submissionCount,
    LocalDateTime lastAcTime,
    List<AcmProblemStatusVO> problemStatus
) {
}
