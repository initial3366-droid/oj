package com.qoj.module.setting.vo;

/**
 * System设置响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public class SystemSettingVO {
    public String settingKey;
    public String settingValue;
    public String category;
    public String description;
}
