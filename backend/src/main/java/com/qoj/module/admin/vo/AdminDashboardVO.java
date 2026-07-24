package com.qoj.module.admin.vo;

import java.util.List;

/**
 * 管理员仪表盘响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
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
