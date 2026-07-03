package com.qoj.module.xcpcio.vo;

import java.time.LocalDateTime;

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
