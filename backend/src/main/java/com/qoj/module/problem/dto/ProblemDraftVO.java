package com.qoj.module.problem.dto;

import java.util.List;

public record ProblemDraftVO(
    String draftId,
    ProblemDraftBasicRequest basic,
    List<ProblemTestCaseRequest> testCases
) {
}
