package com.qoj.module.contest.vo;

import java.time.LocalDateTime;

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
