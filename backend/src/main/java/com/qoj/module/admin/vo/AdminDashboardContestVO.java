package com.qoj.module.admin.vo;

import java.time.LocalDateTime;

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
