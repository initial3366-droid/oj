package com.qoj.module.contest.vo;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 比赛榜单响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ContestScoreboardVO(
    Long contestId,
    String title,
    String type,
    String status,
    LocalDateTime startTime,
    LocalDateTime endTime,
    Integer durationMinutes,
    List<ContestScoreboardProblemVO> problems,
    List<ContestScoreboardRowVO> rows,
    Boolean showClassOnScoreboard
) {
}
