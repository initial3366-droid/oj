package com.qoj.module.problem.entity;

import com.baomidou.mybatisplus.annotation.TableName;

@TableName("problem_tags")
public class ProblemTag {
    public Long problemId;
    public Long tagId;
}
