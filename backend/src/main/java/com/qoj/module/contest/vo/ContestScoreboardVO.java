package com.qoj.module.contest.vo;

import java.time.LocalDateTime;
import java.util.List;

public record ContestScoreboardVO(
    Long contestId,
    String title,
    String type,
    String status,
    LocalDateTime startTime,
    LocalDateTime endTime,
    Integer durationMinutes,
    List<ContestScoreboardProblemVO> problems,
    List<ContestScoreboardRowVO> rows
) {
}
