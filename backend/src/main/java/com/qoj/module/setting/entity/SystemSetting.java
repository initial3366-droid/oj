package com.qoj.module.setting.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * System设置持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("system_settings")
public class SystemSetting {
    @TableId
    public String settingKey;
    public String settingValue;
    public String category;
    public String description;
    public LocalDateTime updatedAt;
    public String updatedBy;
}
