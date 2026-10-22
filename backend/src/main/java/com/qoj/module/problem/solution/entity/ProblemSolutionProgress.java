package com.qoj.module.problem.solution.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("problem_solution_progress")
public class ProblemSolutionProgress {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long problemId;
    public String accountType;
    public Long userId;
    public Integer completedLevel;
    public Integer viewedLevel;
    public Integer currentLevel;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
