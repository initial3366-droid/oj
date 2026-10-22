package com.qoj.module.problem.dto;

/** current 是处理顺序，caseNo 是 ZIP 文件中的原始编号；总数未知时 total 为 null。 */
public record TestCaseImportProgress(String phase, int current, Integer total, int caseNo) {
}
