package com.qoj.module.contest.vo;

/**
 * 比赛题目测试点分数响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ContestProblemCaseScoreVO(
    Integer caseNo,
    Integer score
) {
}
