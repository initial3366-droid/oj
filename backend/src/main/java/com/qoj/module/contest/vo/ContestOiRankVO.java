package com.qoj.module.contest.vo;

import java.time.LocalDateTime;
import java.util.List;

public record ContestOiRankVO(
    Long participantId,
    Long userId,
    String nickname,
    String organizationName,
    Integer rankNo,
    Integer totalScore,
    Integer solvedCount,
    Integer submissionCount,
    LocalDateTime lastScoreUpdateTime,
    List<OiProblemScoreVO> problemScores
) {
}
