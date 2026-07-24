package com.qoj.module.practice.vo;

import java.util.List;

/**
 * 练习Report响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record PracticeReportVO(
    Long practiceId,
    Integer participantCount,
    Integer submissionCount,
    List<PracticeRankVO> rankings,
    List<PracticeSubmissionVO> submissions
) {
}
