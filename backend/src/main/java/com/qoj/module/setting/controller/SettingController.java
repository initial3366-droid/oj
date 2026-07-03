package com.qoj.module.setting.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.FrontendSettingsVO;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.setting.vo.RegisterSettingsVO;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/settings")
public class SettingController {
    private final SystemSettingService settingService;

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
    public ApiResponse<JudgeSettingsVO> getJudgeSettings() {
        return ApiResponse.ok(settingService.getJudgeSettings());
    }
}
