package com.qoj.module.setting.vo;

/**
 * Public判题Settings响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public class PublicJudgeSettingsVO {
    public boolean enabled;
    public boolean enableSandbox;

    /**
     * 构造 Public判题SettingsVO 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public PublicJudgeSettingsVO() {
    }

    /**
     * 构造 Public判题SettingsVO 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public PublicJudgeSettingsVO(boolean enabled, boolean enableSandbox) {
        this.enabled = enabled;
        this.enableSandbox = enableSandbox;
    }
}
