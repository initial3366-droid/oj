package com.qoj.module.setting.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.FrontendSettingsVO;
import com.qoj.module.setting.vo.PublicJudgeSettingsVO;
import com.qoj.module.setting.vo.RegisterSettingsVO;
import org.springframework.web.bind.annotation.*;

/**
 * 设置接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/settings")
public class SettingController {
    private final SystemSettingService settingService;

    /**
     * 构造 设置Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public SettingController(SystemSettingService settingService) {
        this.settingService = settingService;
    }

    /**
     * 获取注册配置（公开接口，用于注册页面）
     */
    @GetMapping("/register")
    public ApiResponse<RegisterSettingsVO> getRegisterSettings() {
        RegisterSettingsVO result = settingService.getRegisterSettings();
        return ApiResponse.ok(result);
    }

    /**
     * 获取站点标题（公开接口）
     */
    @GetMapping("/site-title")
    public ApiResponse<String> getSiteTitle() {
        String title = settingService.getFrontendSettings().siteTitle;
        return ApiResponse.ok(title);
    }

    /**
     * 获取前台完整配置（公开接口）
     */
    @GetMapping("/frontend")
    public ApiResponse<FrontendSettingsVO> getFrontendSettings() {
        return ApiResponse.ok(settingService.getFrontendSettings());
    }

    /**
     * 获取维护模式状态（公开接口）
     */
    @GetMapping("/maintenance-mode")
    public ApiResponse<Boolean> getMaintenanceMode() {
        Boolean enabled = settingService.getFrontendSettings().maintenanceMode;
        return ApiResponse.ok(enabled);
    }

    /**
     * 获取判题配置（公开只读接口，供前端提示判题开关状态）
     */
    @GetMapping("/judge")
    public ApiResponse<PublicJudgeSettingsVO> getJudgeSettings() {
        return ApiResponse.ok(settingService.getPublicJudgeSettings());
    }
}
