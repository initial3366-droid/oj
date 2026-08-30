package com.qoj.module.contest.vo;

/**
 * 管理端比赛报名人员候选项。
 */
public record ContestRegistrationCandidateVO(
    Long id,
    String username,
    String displayName,
    String studentNo
) {
}
