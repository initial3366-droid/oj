package com.qoj.module.classroom.vo;

import java.util.List;

public record StudentImportResultVO(
    Integer successCount,
    Integer failureCount,
    List<RowSuccess> successes,
    List<RowError> errors
) {
    public record RowSuccess(Integer rowNumber, String studentNo, String displayName) {
    }

    public record RowError(Integer rowNumber, String studentNo, String reason) {
    }
}
