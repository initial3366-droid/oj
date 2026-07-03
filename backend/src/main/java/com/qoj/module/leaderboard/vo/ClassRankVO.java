package com.qoj.module.leaderboard.vo;

public record ClassRankVO(
    Long classId,
    String className,
    Integer memberCount,
    Integer acCount,
    String teacherName
) {
}
