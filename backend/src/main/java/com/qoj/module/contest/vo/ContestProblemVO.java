package com.qoj.module.contest.vo;

import java.util.List;

public record ContestProblemVO(
    Long contestProblemId,
    Long problemId,
    String title,
    String label,
    Integer score,
    Integer displayOrder,
    List<ContestProblemCaseScoreVO> caseScores
) {
}
