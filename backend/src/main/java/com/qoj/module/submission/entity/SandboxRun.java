package com.qoj.module.submission.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 沙箱Run持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("sandbox_runs")
public class SandboxRun {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long userId;
    public String code;
    public String language;
    public String input;
    public String output;
    public String status;
    public LocalDateTime runAt;
}
