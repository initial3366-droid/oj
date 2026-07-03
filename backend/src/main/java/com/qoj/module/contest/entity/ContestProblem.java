package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("contest_problems")
public class ContestProblem {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long contestId;
    public Long problemId;
    public String label;
    public Integer score;
    public Integer fullScore;
    public Integer displayOrder;
    public String title;
    public String statement;
    public String inputFormat;
    public String outputFormat;
    public String sampleCases;
    public Integer timeLimit;
    public Integer memoryLimit;
    public Integer difficulty;
    public String tags;
    public String domjudgeProblemId;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    public Long getContestId() { return contestId; }
    public Integer getDisplayOrder() { return displayOrder; }
}
