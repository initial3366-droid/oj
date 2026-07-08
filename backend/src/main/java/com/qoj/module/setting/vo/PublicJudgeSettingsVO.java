package com.qoj.module.setting.vo;

public class PublicJudgeSettingsVO {
    public boolean enabled;
    public boolean enableSandbox;

    public PublicJudgeSettingsVO() {
    }

    public PublicJudgeSettingsVO(boolean enabled, boolean enableSandbox) {
        this.enabled = enabled;
        this.enableSandbox = enableSandbox;
    }
}
