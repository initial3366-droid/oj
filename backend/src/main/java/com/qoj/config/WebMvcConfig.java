package com.qoj.config;

import com.qoj.security.AdminApiInterceptor;
import com.qoj.security.MaintenanceModeInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    private final AdminApiInterceptor adminApiInterceptor;
    private final MaintenanceModeInterceptor maintenanceModeInterceptor;

    public WebMvcConfig(AdminApiInterceptor adminApiInterceptor, MaintenanceModeInterceptor maintenanceModeInterceptor) {
        this.adminApiInterceptor = adminApiInterceptor;
        this.maintenanceModeInterceptor = maintenanceModeInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注册维护模式拦截器（优先级最高）
        registry.addInterceptor(maintenanceModeInterceptor)
            .addPathPatterns("/api/**")
            .order(0);

        // 注册管理端权限拦截器
        registry.addInterceptor(adminApiInterceptor)
            .addPathPatterns("/api/admin/v1/**")
            .order(1);
    }
}
