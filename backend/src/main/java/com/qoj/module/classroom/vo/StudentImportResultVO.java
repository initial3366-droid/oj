package com.qoj.module.classroom.vo;

import java.util.List;

/**
 * StudentImport结果响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record StudentImportResultVO(
    Integer successCount,
    Integer failureCount,
    List<RowSuccess> successes,
    List<RowError> errors
) {
    /**
     * RowSuccess响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record RowSuccess(Integer rowNumber, String studentNo, String displayName) {
    }

    /**
     * RowError响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record RowError(Integer rowNumber, String studentNo, String reason) {
    }
}
