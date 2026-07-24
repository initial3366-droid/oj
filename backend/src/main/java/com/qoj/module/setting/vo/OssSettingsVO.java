package com.qoj.module.setting.vo;

/**
 * 腾讯云 COS 存储配置，沿用 system.oss_config 以兼容已有部署。
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
