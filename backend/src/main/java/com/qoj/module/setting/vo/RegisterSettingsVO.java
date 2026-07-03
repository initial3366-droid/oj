package com.qoj.module.setting.vo;

public class RegisterSettingsVO {
    public Boolean enabled;
    public Boolean emailVerification;
    public EmailConfigVO emailConfig;
    public FieldsConfigVO fieldsConfig;

    public static class EmailConfigVO {
        public String host;
        public Integer port;
        public String username;
        public Boolean useSsl;
        public String subject;
        public String content;
    }

    public static class FieldsConfigVO {
        public FieldConfig studentNo;
        public FieldConfig email;
    }

    public static class FieldConfig {
        public Boolean enabled;
        public Boolean required;
    }
}
