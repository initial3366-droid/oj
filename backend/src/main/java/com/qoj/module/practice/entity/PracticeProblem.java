package com.qoj.module.practice.entity;

import com.baomidou.mybatisplus.annotation.TableName;

@TableName("practice_problems")
public class PracticeProblem {
    public Long practiceId;
    public Long problemId;
    public Integer displayOrder;
    public Integer score;
}
