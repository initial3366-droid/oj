package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("contest_problem_case_scores")
public class ContestProblemCaseScore {
    public Long contestId;
    public Long problemId;
    public Integer caseNo;
    public Integer score;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
