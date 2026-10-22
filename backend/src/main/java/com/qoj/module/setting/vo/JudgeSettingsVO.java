package com.qoj.module.setting.vo;

/** Administrative judge settings; execution endpoints and secrets stay in environment config. */
public class JudgeSettingsVO {
    public boolean enabled;
    public boolean enableSandbox;
    public int maxConcurrent;
    public int threadPoolSize;
    public int queueBatchSize;
    public long pollIntervalMs;
    public int staleTaskMinutes;
}
