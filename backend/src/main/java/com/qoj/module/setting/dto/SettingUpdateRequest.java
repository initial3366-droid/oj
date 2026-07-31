package com.qoj.module.setting.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 设置Update请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public class SettingUpdateRequest {
    @NotBlank(message = "设置键不能为空")
    public String settingKey;

    @NotBlank(message = "设置值不能为空")
    public String settingValue;
}
