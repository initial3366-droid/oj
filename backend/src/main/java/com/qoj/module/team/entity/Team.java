package com.qoj.module.team.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 队伍持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("teams")
public class Team {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String name;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
