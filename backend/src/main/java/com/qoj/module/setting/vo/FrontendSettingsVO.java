package com.qoj.module.setting.vo;

/**
 * FrontendSettings响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public class FrontendSettingsVO {
    public String siteTitle;
    public String siteLogo;
    public Boolean maintenanceMode;
    public String footerText;
    public String icpNumber;
    public String footerLink1Text;
    public String footerLink1Url;
    public String footerLink2Text;
    public String footerLink2Url;
}
