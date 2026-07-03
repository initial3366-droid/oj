package com.qoj.module.practice.vo;

public record PracticeRankVO(
    Long userId,
    String displayName,
    Integer score,
    Integer solved,
    Integer submissionCount
) {
}
