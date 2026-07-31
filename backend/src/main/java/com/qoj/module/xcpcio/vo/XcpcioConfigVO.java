package com.qoj.module.xcpcio.vo;

import java.time.LocalDateTime;

/**
 * Xcpcio配置响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record XcpcioConfigVO(
    Long contestId,
    Boolean enabled,
    String mode,
    String xcpcioContestId,
    Boolean hasToken,
    Boolean hasClicsAccessToken,
    String boardUrl,
    Boolean syncEnabled,
    Integer syncIntervalSeconds,
    String status,
    LocalDateTime lastSyncAt,
    LocalDateTime lastSuccessAt,
    String lastError,
    LocalDateTime lastErrorAt,
    Integer consecutiveFailures,
    String clicsBaseUrl,
    String clicsScoreboardUrl
) {
}
