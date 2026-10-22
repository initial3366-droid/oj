package com.qoj.module.contest.vo;

import java.util.List;

public record ContestRegistrationImportResultVO(int addedCount, int skippedCount, int failedCount, List<Row> rows) {
    public record Row(int rowNumber, String studentNo, String status, String message) {}
}
