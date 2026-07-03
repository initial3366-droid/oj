package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("contest_audiences")
public class ContestAudience {
    public Long contestId;
    public String audienceType;
    public Long audienceId;
    public LocalDateTime createdAt;
}
