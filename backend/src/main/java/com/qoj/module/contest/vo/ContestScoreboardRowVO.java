package com.qoj.module.contest.vo;

import java.time.LocalDateTime;
import java.util.List;

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
