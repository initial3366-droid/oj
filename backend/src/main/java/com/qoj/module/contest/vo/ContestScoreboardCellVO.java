package com.qoj.module.contest.vo;

import java.time.LocalDateTime;

/**
 * 比赛榜单Cell响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ContestScoreboardCellVO(
    Long problemId,
    String label,
    Integer attempts,
    Boolean accepted,
    Integer penalty,
    Integer score,
    LocalDateTime acceptedAt
) {
}
