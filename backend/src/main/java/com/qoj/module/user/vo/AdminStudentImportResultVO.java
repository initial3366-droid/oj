package com.qoj.module.user.vo;

import java.util.List;

/** 管理后台批量导入学生的逐行结果。 */
public record AdminStudentImportResultVO(
    Integer successCount,
    Integer failureCount,
    List<RowSuccess> successes,
    List<RowError> errors
) {
    public record RowSuccess(Integer rowNumber, String username, String studentNo, String className) {
    }

    public record RowError(Integer rowNumber, String username, String studentNo, String reason) {
    }
}
