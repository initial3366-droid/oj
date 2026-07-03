package com.qoj.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestClient;

/**
 * 应用全局 Bean 配置。
 *
 * 注册基础设施 Bean：
 * 1. PasswordEncoder — BCrypt 密码编码器（强度因子 12）
 * 2. RestClient — HTTP 客户端（用于调用外部服务）
 * 3. QojProperties — 通过 @EnableConfigurationProperties 绑定 qoj.* 配置项
 */
@Configuration
@EnableConfigurationProperties(QojProperties.class) // 将 QojProperties 注册为 Spring Bean，使其可通过 @Autowired 注入
public class AppConfig {

    /**
     * BCrypt 密码编码器。
     * 强度因子 12 表示 2^12 = 4096 轮哈希迭代，平衡安全性与登录响应延迟。
     * 生产环境如需更高安全性可调整为 13-14。
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    /**
     * 同步 HTTP 客户端，用于调用判题服务、代理服务等外部 API。
     * 使用 builder 模式创建，可后续扩展超时、拦截器等配置。
     */
    @Bean
    public RestClient restClient() {
        return RestClient.builder().build();
    }
}
