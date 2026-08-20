package com.qoj.module.contest.vo;

/**
 * 当前用户在比赛中已通过的题目标识，包含原题 ID 和比赛题目 ID 供前端匹配。
 */
public record ContestAcceptedProblemVO(
    Long problemId,
    Long contestProblemId
) {
}
