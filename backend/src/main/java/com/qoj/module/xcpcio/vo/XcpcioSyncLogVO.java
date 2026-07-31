package com.qoj.module.xcpcio.vo;

import java.time.LocalDateTime;

/**
 * XcpcioSyncLog响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
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
