package com.qoj.module.contest.vo;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Public榜单响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public class PublicScoreboardVO {
    public Long contestId;
    public String contestTitle;
    public String contestType; // ACM or OI
    public LocalDateTime startTime;
    public LocalDateTime endTime;
    public Boolean frozen;
    public LocalDateTime freezeTime;
    public String boardState; // LIVE/FROZEN/ROLLING/FINAL
    public Boolean showClassOnScoreboard;
    public List<ProblemInfo> problems;
    public List<UserRank> rows;

    /**
     * 题目Info响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public static class ProblemInfo {
        public String label;
        public String title;
        public Integer score; // For OI mode
    }

    /**
     * 用户排名响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public static class UserRank {
        public Integer rank;
        public Long userId;
        public String username;
        public String displayName;
        public Long classId;
        public String className;
        public Integer solved; // Number of problems solved (ACM)
        public Integer penalty; // Penalty time in minutes (ACM)
        public Integer totalScore; // Total score (OI)
        public LocalDateTime lastAcTime;
        public String medal; // GOLD/SILVER/BRONZE/null
        public Boolean revealed; // For rolling scoreboard
        public Integer frozenRank;
        public Integer finalRank;
        public Boolean starred;
        public Map<String, ProblemStatus> problems; // key: problem label
    }

    /**
     * 题目状态响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public static class ProblemStatus {
        public Boolean accepted;
        public Integer attempts; // Number of submissions
        public Integer timeMinutes; // Time to first AC in minutes from contest start
        public LocalDateTime acceptedAt;
        public Integer score; // Score for this problem (OI)
        public List<SubmissionHistory> history;
    }

    /**
     * 提交History响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public static class SubmissionHistory {
        public String status;
        public LocalDateTime submittedAt;
        public Integer timeMinutes;
    }
}
