package com.qoj.module.admin.vo;

import java.time.LocalDateTime;

/**
 * 管理员仪表盘比赛响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record AdminDashboardContestVO(
    Long id,
    String title,
    LocalDateTime startTime,
    LocalDateTime endTime,
    String type,
    String audience,
    String status
) {
}
