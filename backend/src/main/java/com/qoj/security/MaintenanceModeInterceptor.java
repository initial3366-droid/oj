package com.qoj.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ApiResponse;
import com.qoj.module.setting.service.SystemSettingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * 维护模式拦截器
 * 当维护模式开启时，阻止所有非管理员 API 访问
 */
@Component
public class MaintenanceModeInterceptor implements HandlerInterceptor {
    private final SystemSettingService settingService;
    private final ObjectMapper objectMapper;

    public MaintenanceModeInterceptor(SystemSettingService settingService, ObjectMapper objectMapper) {
        this.settingService = settingService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 允许管理员 API 和设置 API 通过
        String requestUri = request.getRequestURI();
        if (requestUri.startsWith("/api/admin/") || requestUri.startsWith("/api/v1/settings/maintenance-mode")) {
            return true;
        }

        // 检查维护模式是否开启
        Boolean maintenanceMode = settingService.getFrontendSettings().maintenanceMode;
        if (maintenanceMode != null && maintenanceMode) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(objectMapper.writeValueAsString(
                ApiResponse.fail(503, "系统维护中，请稍后再试")
            ));
            return false;
        }

        return true;
    }
}
