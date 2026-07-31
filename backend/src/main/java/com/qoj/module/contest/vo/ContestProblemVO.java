package com.qoj.module.contest.vo;

import java.util.List;

/**
 * 比赛题目响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ContestProblemVO(
    Long contestProblemId,
    Long problemId,
    String title,
    String label,
    Integer score,
    Integer displayOrder,
    List<ContestProblemCaseScoreVO> caseScores,
    Long submissionCount,
    Long acceptedCount
) {
}
