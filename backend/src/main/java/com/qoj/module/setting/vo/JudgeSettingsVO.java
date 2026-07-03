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
    public String domjudgeBaseUrl;
    public String domjudgeApiKey;
    public boolean hasDomjudgeApiKey;
    public String domjudgeContestId;
    public long domjudgePollIntervalMs;
}
