package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 比赛题目测试点分数持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("contest_problem_case_scores")
public class ContestProblemCaseScore {
    public Long contestId;
    public Long problemId;
    public Integer caseNo;
    public Integer score;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
