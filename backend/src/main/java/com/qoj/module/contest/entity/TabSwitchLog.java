package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

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
