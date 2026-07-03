package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("contest_rolling_states")
public class ContestRollingState {
    @TableId
    public Long contestId;
    public String status;
    public Integer currentStep;
    public Integer totalSteps;
    public String stepsJson;
    public Long startedBy;
    public Long updatedBy;
    public LocalDateTime startedAt;
    public LocalDateTime publishedAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
