package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 比赛Audience持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("contest_audiences")
public class ContestAudience {
    public Long contestId;
    public String audienceType;
    public Long audienceId;
    public LocalDateTime createdAt;
}
