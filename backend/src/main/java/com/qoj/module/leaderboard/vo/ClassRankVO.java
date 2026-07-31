package com.qoj.module.leaderboard.vo;

/**
 * 班级排名响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ClassRankVO(
    Long classId,
    String className,
    Integer memberCount,
    Integer acCount,
    String teacherName
) {
}
