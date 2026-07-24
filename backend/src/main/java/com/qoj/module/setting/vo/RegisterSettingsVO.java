package com.qoj.module.setting.vo;

/**
 * 注册Settings响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public class RegisterSettingsVO {
    public Boolean enabled;
    public Boolean emailVerification;
    public EmailConfigVO emailConfig;
    public FieldsConfigVO fieldsConfig;

    /**
     * Email配置响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public static class EmailConfigVO {
        public String host;
        public Integer port;
        public String username;
        public Boolean useSsl;
        public String subject;
        public String content;
    }

    /**
     * Fields配置响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public static class FieldsConfigVO {
        public FieldConfig studentNo;
        public FieldConfig email;
    }

    /**
     * Field响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public static class FieldConfig {
        public Boolean enabled;
        public Boolean required;
    }
}
