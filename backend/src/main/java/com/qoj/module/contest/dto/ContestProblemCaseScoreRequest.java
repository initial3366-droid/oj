package com.qoj.module.contest.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 比赛题目测试点分数请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ContestProblemCaseScoreRequest(
    @NotNull Integer caseNo,
    @NotNull Integer score
) {
}
