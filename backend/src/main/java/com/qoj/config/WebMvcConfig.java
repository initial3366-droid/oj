package com.qoj.config;

import com.qoj.security.AdminApiInterceptor;
import com.qoj.security.MaintenanceModeInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * WebMvc配置类型。集中声明运行参数或 Spring 组件装配规则。
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    private final AdminApiInterceptor adminApiInterceptor;
    private final MaintenanceModeInterceptor maintenanceModeInterceptor;

    /**
     * 构造 WebMvc配置 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public WebMvcConfig(AdminApiInterceptor adminApiInterceptor, MaintenanceModeInterceptor maintenanceModeInterceptor) {
        this.adminApiInterceptor = adminApiInterceptor;
        this.maintenanceModeInterceptor = maintenanceModeInterceptor;
    }

    /**
     * 创建或提交Interceptors。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
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
