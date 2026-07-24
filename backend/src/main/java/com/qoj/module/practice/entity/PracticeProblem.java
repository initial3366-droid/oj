package com.qoj.module.practice.entity;

import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 练习题目持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("practice_problems")
public class PracticeProblem {
    public Long practiceId;
    public Long problemId;
    public Integer displayOrder;
    public Integer score;
}
