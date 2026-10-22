package com.qoj.module.problem.solution.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("problem_solution_nodes")
public class ProblemSolutionNode {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long problemId;
    public Long parentId;
    public Integer levelNo;
    public String content;
    public String source;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
