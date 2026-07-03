package com.qoj.module.problem.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@TableName("problems")
public class Problem {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String title;
    public String statement;
    public String inputFormat;
    public String outputFormat;
    public String sampleCases;
    public Integer timeLimit;
    public Integer memoryLimit;
    public Integer difficulty;
    public String tags;
    public Long folderId;
    public Long ownerId;
    public Boolean isPublic;
    public String domjudgeProblemId;
    public BigDecimal acRate;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public Boolean isDeleted;
    public LocalDateTime deletedAt;
}
