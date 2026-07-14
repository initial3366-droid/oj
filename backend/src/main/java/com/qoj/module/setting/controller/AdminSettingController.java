package com.qoj.module.setting.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.setting.dto.EmailConfigRequest;
import com.qoj.module.setting.dto.PasswordChangeRequest;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.AgentSettingsVO;
import com.qoj.module.setting.vo.FrontendSettingsVO;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.setting.vo.OssSettingsVO;
import com.qoj.module.setting.vo.RegisterSettingsVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 管理员设置接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/settings")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminSettingController {
    private final SystemSettingService settingService;

    /**
     * 构造 管理员设置Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminSettingController(SystemSettingService settingService) {
        this.settingService = settingService;
    }

    /**
     * 获取前端配置
     */
    @GetMapping("/frontend")
    public ApiResponse<FrontendSettingsVO> getFrontendSettings() {
        FrontendSettingsVO result = settingService.getFrontendSettings();
        return ApiResponse.ok(result);
    }

    /**
     * 获取注册配置
     */
    @GetMapping("/register")
    public ApiResponse<RegisterSettingsVO> getRegisterSettings() {
        RegisterSettingsVO result = settingService.getRegisterSettings();
        return ApiResponse.ok(result);
    }

    /**
     * 获取 AI 助手配置
     */
    @GetMapping("/system/agent")
    public ApiResponse<AgentSettingsVO> getAgentSettings() {
        return ApiResponse.ok(settingService.getAgentSettings());
    }

    /**
     * 更新 AI 助手配置
     */
    @PutMapping("/system/agent")
    public ApiResponse<Void> updateAgentSettings(@RequestBody AgentSettingsVO request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateAgentSettings(request, authUser);
        return ApiResponse.ok();
    }

    /**
     * 获取 OSS 配置
     */
    @GetMapping("/system/oss")
    public ApiResponse<OssSettingsVO> getOssSettings() {
        return ApiResponse.ok(settingService.getOssSettings());
    }

    /**
     * 更新 OSS 配置
     */
    @PutMapping("/system/oss")
    public ApiResponse<Void> updateOssSettings(@RequestBody OssSettingsVO request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateOssSettings(request, authUser);
        return ApiResponse.ok();
    }

    /**
     * 更新站点标题
     */
    @PutMapping("/frontend/site-title")
    public ApiResponse<Void> updateSiteTitle(@RequestBody SiteTitleRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateSiteTitle(request.title, authUser);
        return ApiResponse.ok();
    }

    /**
     * Site标题请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    public static class SiteTitleRequest {
        public String title;
    }

    /**
     * 更新维护模式
     */
    @PutMapping("/frontend/maintenance-mode")
    public ApiResponse<Void> updateMaintenanceMode(@RequestBody MaintenanceModeRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateMaintenanceMode(request.enabled, authUser);
        return ApiResponse.ok();
    }

    /**
     * Maintenance模式请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    public static class MaintenanceModeRequest {
        public Boolean enabled;
    }

    /**
     * 更新前端配置
     */
    @PutMapping("/frontend")
    public ApiResponse<Void> updateFrontendSettings(@RequestBody FrontendSettingsRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateFrontendSettings(
            request.siteTitle,
            request.siteLogo,
            request.maintenanceMode,
            request.footerText,
            request.icpNumber,
            request.footerLink1Text,
            request.footerLink1Url,
            request.footerLink2Text,
            request.footerLink2Url,
            authUser
        );
        return ApiResponse.ok();
    }

    /**
     * FrontendSettings请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    public static class FrontendSettingsRequest {
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

    /**
     * 更新底部文案
     */
    @PutMapping("/frontend/footer-text")
    public ApiResponse<Void> updateFooterText(@RequestBody FooterTextRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateFooterText(request.text, authUser);
        return ApiResponse.ok();
    }

    /**
     * FooterText请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    public static class FooterTextRequest {
        public String text;
    }

    /**
     * 更新备案号
     */
    @PutMapping("/frontend/icp-number")
    public ApiResponse<Void> updateIcpNumber(@RequestBody IcpNumberRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateIcpNumber(request.icpNumber, authUser);
        return ApiResponse.ok();
    }

    /**
     * IcpNumber请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    public static class IcpNumberRequest {
        public String icpNumber;
    }

    /**
     * 更新底部右侧链接
     */
    @PutMapping("/frontend/footer-links")
    public ApiResponse<Void> updateFooterLinks(@RequestBody FooterLinksRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateFooterLinks(
            request.link1Text,
            request.link1Url,
            request.link2Text,
            request.link2Url,
            authUser
        );
        return ApiResponse.ok();
    }

    /**
     * FooterLinks请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    public static class FooterLinksRequest {
        public String link1Text;
        public String link1Url;
        public String link2Text;
        public String link2Url;
    }

    /**
     * 修改管理员密码
     */
    @PutMapping("/admin/password")
    public ApiResponse<Void> changeAdminPassword(@Valid @RequestBody PasswordChangeRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.changeAdminPassword(request, authUser);
        return ApiResponse.ok();
    }

    /**
     * 更新注册开关
     */
    @PutMapping("/register/enabled")
    public ApiResponse<Void> updateRegisterEnabled(@RequestBody RegisterEnabledRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateRegisterEnabled(request.enabled, authUser);
        return ApiResponse.ok();
    }

    /**
     * 注册启用状态请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    public static class RegisterEnabledRequest {
        public Boolean enabled;
    }

    /**
     * 更新邮箱验证开关
     */
    @PutMapping("/register/email-verification")
    public ApiResponse<Void> updateEmailVerification(@RequestBody EmailVerificationRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateEmailVerification(request.enabled, authUser);
        return ApiResponse.ok();
    }

    /**
     * EmailVerification请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    public static class EmailVerificationRequest {
        public Boolean enabled;
    }

    /**
     * 更新邮箱配置
     */
    @PutMapping("/register/email-config")
    public ApiResponse<Void> updateEmailConfig(@Valid @RequestBody EmailConfigRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateEmailConfig(request, authUser);
        return ApiResponse.ok();
    }

    /**
     * 更新注册字段配置
     */
    @PutMapping("/register/fields-config")
    public ApiResponse<Void> updateFieldsConfig(@RequestBody RegisterSettingsVO.FieldsConfigVO config) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateFieldsConfig(config, authUser);
        return ApiResponse.ok();
    }

    /**
     * 获取判题配置（判题开关 + 最大并发数）
     */
    @GetMapping("/judge")
    public ApiResponse<JudgeSettingsVO> getJudgeSettings() {
        return ApiResponse.ok(settingService.getJudgeSettings());
    }

    /**
     * 更新判题Settings。调用前会结合当前登录身份执行权限判断；执行持久化写入。
     */
    @PutMapping("/judge")
    public ApiResponse<Void> updateJudgeSettings(@RequestBody JudgeSettingsVO request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateJudgeSettings(request, authUser);
        return ApiResponse.ok();
    }

    /**
     * 更新判题开关
     */
    @PutMapping("/judge/enabled")
    public ApiResponse<Void> updateJudgeEnabled(@RequestBody JudgeEnabledRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateJudgeEnabled(request.enabled, authUser);
        return ApiResponse.ok();
    }

    /**
     * 判题启用状态请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    public static class JudgeEnabledRequest {
        public Boolean enabled;
    }

    /**
     * 更新判题最大并发数
     */
    @PutMapping("/judge/max-concurrent")
    public ApiResponse<Void> updateJudgeMaxConcurrent(@RequestBody JudgeMaxConcurrentRequest request) {
        AuthUser authUser = CurrentUser.required();
        settingService.updateJudgeMaxConcurrent(request.maxConcurrent, authUser);
        return ApiResponse.ok();
    }

    /**
     * 判题MaxConcurrent请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    public static class JudgeMaxConcurrentRequest {
        public Integer maxConcurrent;
    }
}
