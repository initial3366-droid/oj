package com.qoj.module.setting.dto;

import jakarta.validation.constraints.NotBlank;

public class SettingUpdateRequest {
    @NotBlank(message = "设置键不能为空")
    public String settingKey;

    @NotBlank(message = "设置值不能为空")
    public String settingValue;
}
