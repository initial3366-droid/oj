package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 比赛报名持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("contest_registrations")
public class ContestRegistration {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long contestId;
    public Long userId;
    public String username;
    public String displayName;
    public String identityType;
    public Long identityId;
    public Boolean starred;
    public String status; // PENDING, APPROVED, REJECTED
    public LocalDateTime registeredAt;
}
