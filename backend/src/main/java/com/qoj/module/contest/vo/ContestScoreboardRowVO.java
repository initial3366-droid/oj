package com.qoj.module.contest.vo;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 比赛榜单Row响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ContestScoreboardRowVO(
    Integer rank,
    Long userId,
    String displayName,
    Integer solved,
    Integer penalty,
    Integer score,
    LocalDateTime lastAcceptedAt,
    List<ContestScoreboardCellVO> cells,
    String identityType,
    Long identityId,
    Boolean starred,
    String medal,
    Long classId,
    String className
) {
}
