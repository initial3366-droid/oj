package com.qoj.module.practice.vo;

import java.util.List;

public record PracticeReportVO(
    Long practiceId,
    Integer participantCount,
    Integer submissionCount,
    List<PracticeRankVO> rankings,
    List<PracticeSubmissionVO> submissions
) {
}
