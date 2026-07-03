package com.qoj.module.problem.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("problem_test_cases")
public class ProblemTestCase {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long problemId;
    public Integer caseNo;
    public String inputData;
    public String outputData;
    public String explanation;
    public Boolean sample;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
