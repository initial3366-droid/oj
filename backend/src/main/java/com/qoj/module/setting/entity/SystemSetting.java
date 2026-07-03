package com.qoj.module.setting.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

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
