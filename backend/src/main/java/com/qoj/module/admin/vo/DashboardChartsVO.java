package com.qoj.module.admin.vo;

import java.util.List;
import java.util.Map;

/**
 * 仪表盘Charts响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public class DashboardChartsVO {

    /**
     * TotalStats响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record TotalStats(
        long userCount, Map<String, Long> userByRole,
        long problemCount, Map<Integer, Long> problemByDifficulty,
        long submissionCount, double passRate,
        long contestCount, Map<String, Long> contestByType
    ) {}

    /**
     * Daily提交响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record DailySubmission(String date, long total, long accepted) {}
    /**
     * VerdictCount响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record VerdictCount(String verdict, long count) {}
    /**
     * LanguageCount响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record LanguageCount(String language, long count, double percentage) {}
    /**
     * DifficultyCount响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record DifficultyCount(int difficulty, long count) {}
    /**
     * HourlyCount响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record HourlyCount(int hour, long count) {}
    /**
     * Monthly用户Count响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record MonthlyUserCount(String month, long cumulative) {}
    /**
     * Top题目响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record TopProblem(long problemId, String title, int difficulty, long submissions, double acRate) {}
}
