package com.qoj.module.setting.vo;

/**
 * AI 助手配置，存储于 system_settings。
 */
public class AgentSettingsVO {
    public Boolean enabled;
    public String baseUrl;
    public String apiKey;
    public String model;
    public Long timeoutMs;
    public Integer maxCodeChars;
}
