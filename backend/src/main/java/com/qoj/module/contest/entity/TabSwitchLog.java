package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * TabSwitchLog持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("tab_switch_logs")
public class TabSwitchLog {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long userId;
    public Long contestId;
    public Integer switchCount;
    public String logDetail;
    public LocalDateTime createdAt;
}
