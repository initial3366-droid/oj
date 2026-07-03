package com.qoj.module.admin.vo;

import java.util.List;

public record AdminDashboardVO(
    long onlineUserCount,
    long userCount,
    long problemCount,
    long submissionCount,
    long todaySubmissionCount,
    long todayAcceptedCount,
    long todayActiveUserCount,
    long activeContestCount,
    List<AdminDashboardContestVO> recentContests,
    DashboardChartsVO.TotalStats totalStats,
    List<DashboardChartsVO.DailySubmission> submissionTrend,
    List<DashboardChartsVO.VerdictCount> verdictDistribution,
    List<DashboardChartsVO.LanguageCount> languageUsage,
    List<DashboardChartsVO.DifficultyCount> difficultyDistribution,
    List<DashboardChartsVO.HourlyCount> hourlyActivity,
    List<DashboardChartsVO.MonthlyUserCount> userGrowth,
    List<DashboardChartsVO.TopProblem> topProblems
) {
}
