package com.qoj.module.admin.vo;

import java.util.List;
import java.util.Map;

public class DashboardChartsVO {

    public record TotalStats(
        long userCount, Map<String, Long> userByRole,
        long problemCount, Map<Integer, Long> problemByDifficulty,
        long submissionCount, double passRate,
        long contestCount, Map<String, Long> contestByType
    ) {}

    public record DailySubmission(String date, long total, long accepted) {}
    public record VerdictCount(String verdict, long count) {}
    public record LanguageCount(String language, long count, double percentage) {}
    public record DifficultyCount(int difficulty, long count) {}
    public record HourlyCount(int hour, long count) {}
    public record MonthlyUserCount(String month, long cumulative) {}
    public record TopProblem(long problemId, String title, int difficulty, long submissions, double acRate) {}
}
