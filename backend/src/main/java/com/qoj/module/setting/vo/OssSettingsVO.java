package com.qoj.module.setting.vo;

/**
 * OSS 存储配置，存储于 system_settings。
 */
public class OssSettingsVO {
    public Boolean enabled;
    public String endpoint;
    public String bucket;
    public String region;
    public String accessKeyId;
    public String accessKeySecret;
    public String publicBaseUrl;
    public String dir;
    public Integer maxSizeMb;
}
