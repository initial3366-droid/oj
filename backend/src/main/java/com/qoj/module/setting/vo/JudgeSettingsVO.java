package com.qoj.module.setting.vo;

public class JudgeSettingsVO {
    public boolean enabled;
    public String mode;
    public String contestMode;
    public boolean enableUnsafeLocalJudge;
    public boolean enableSandbox;
    public int maxConcurrent;
    public int threadPoolSize;
    public int queueBatchSize;
    public long pollIntervalMs;
    public String ccpcojJudgeUsername;
    public String ccpcojJudgePassword;
    public boolean hasCcpcojJudgePassword;
    public int ccpcojSessionTtlMinutes;
    public int ccpcojStaleTaskMinutes;
}
