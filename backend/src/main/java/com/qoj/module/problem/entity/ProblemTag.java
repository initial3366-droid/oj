package com.qoj.module.problem.entity;

import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 题目Tag持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("problem_tags")
public class ProblemTag {
    public Long problemId;
    public Long tagId;
}
