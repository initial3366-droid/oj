package com.qoj.module.submission.dto;

import java.util.List;

/**
 * Backend-internal normalized judge result. External judge protocols must map
 * their values into QOJ statuses before calling the callback service.
 */
public class JudgeResultCallbackRequest {
    public Long submissionId;
    public String status;
    public Integer timeUsed;
    public Integer memoryUsed;
    public Integer score;
    public List<CaseResultDTO> caseResults;

    /** Per-case metrics used by submission detail and OI score calculation. */
    public static class CaseResultDTO {
        public Integer caseNo;
        public Integer subtaskNo;
        public String status;
        public Integer score;
        public Integer maxScore;
        public Integer timeUsed;
        public Integer memoryUsed;
    }
}
