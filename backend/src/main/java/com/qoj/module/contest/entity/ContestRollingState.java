package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 比赛RollingState持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
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
