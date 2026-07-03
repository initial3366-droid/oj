package com.qoj.module.xcpcio.vo;

import java.time.LocalDateTime;

public record XcpcioSyncLogVO(
    Long id,
    Long contestId,
    String syncType,
    String status,
    LocalDateTime startedAt,
    LocalDateTime finishedAt,
    Integer pushedSubmissions,
    Integer httpStatus,
    String errorMessage
) {
}
