package com.qoj.module.submission.dto;

import java.util.List;

public class JudgeResultCallbackRequest {
    public Long submissionId;
    public String status;
    public Integer timeUsed;
    public Integer memoryUsed;
    public Integer score;
    public List<CaseResultDTO> caseResults;

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
