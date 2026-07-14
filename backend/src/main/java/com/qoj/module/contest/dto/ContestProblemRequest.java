package com.qoj.module.contest.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * 比赛题目请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ContestProblemRequest(
    @NotNull Long problemId,
    @NotNull String label,
    Integer score,
    Integer displayOrder,
    List<ContestProblemCaseScoreRequest> caseScores
) {
}
