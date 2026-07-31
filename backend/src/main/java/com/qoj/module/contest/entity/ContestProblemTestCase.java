package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 比赛题目Test测试点持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("contest_problem_test_cases")
public class ContestProblemTestCase {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long contestProblemId;
    public Integer caseNo;
    public String inputData;
    public String outputData;
    public String explanation;
    public Boolean sample;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
