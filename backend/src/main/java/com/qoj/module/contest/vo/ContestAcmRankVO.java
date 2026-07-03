package com.qoj.module.contest.vo;

import java.time.LocalDateTime;
import java.util.List;

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
