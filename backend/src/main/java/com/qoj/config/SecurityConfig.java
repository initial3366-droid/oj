package com.qoj.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ApiResponse;
import com.qoj.security.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Spring Security 核心配置类。
 *
 * 职责:
 * 1. 定义 URL 白名单（无需认证即可访问的接口/页面）
 * 2. 定义角色权限（SUPER_ADMIN / TEACHER 各自可访问的 API）
 * 3. 注册 JWT 认证过滤器到过滤器链中
 * 4. 配置 CORS 跨域策略（支持反向代理场景自动识别 origin）
 * 5. 配置无状态会话（JWT 方式）
 * 6. 统一认证失败/权限不足的 JSON 响应
 *
 * 认证流程:
 * 请求 → CORS 预检 → JwtAuthenticationFilter 解析 Token → SecurityContext
 *       → 权限匹配（permitAll / hasRole / hasAnyRole）
 *       → 放行 / 拒绝（返回 JSON 错误信息）
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final QojProperties properties;
    private final ObjectMapper objectMapper;

    @Value("${admin.path-prefix:admin}")
    private String adminPathPrefix;

    public SecurityConfig(
        JwtAuthenticationFilter jwtAuthenticationFilter,
        QojProperties properties,
        ObjectMapper objectMapper
    ) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * 构建安全过滤器链。
     *
     * 关键配置:
     * - csrf 禁用（前后端分离，无 Cookie-session）
     * - CORS 自定义（仅允许配置的源，不信任请求头动态放行）
     * - 无状态会话（每次请求独立认证，不创建 session）
     * - URL 权限分层:
     *   .permitAll()   → 公开资源（登录/注册/首页/榜单等；Swagger 需超级管理员）
     *   .hasRole()     → 超级管理员独享（用户管理/班级/教师）
     *   .hasAnyRole()  → 后台通用（管理员+教师）
     *   .anyRequest().authenticated() → 其余全部需认证
     * - 异常处理: 401 未登录 / 403 无权限，统一返回 JSON 格式
     * - JWT 过滤器插在 UsernamePasswordAuthenticationFilter 之前执行
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/assets/**").permitAll()
                .requestMatchers("/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh", "/api/v1/auth/reset-password").permitAll()
                .requestMatchers("/api/v1/captcha/**").permitAll()
                .requestMatchers("/api/admin/v1/auth/login").permitAll()
                .requestMatchers("/ws/**", "/ws-sockjs/**").permitAll()
                .requestMatchers(
                    "/",
                    "/index.html",
                    "/banners/**",
                    "/favicon.ico",
                    "/robots.txt"
                ).permitAll()
                .requestMatchers(HttpMethod.GET,
                    "/" + adminPathPrefix + "/**",
                    "/admin/**",
                    "/teacher/**",
                    "/problems/**",
                    "/practice/**",
                    "/contests/**",
                    "/leaderboard",
                    "/submission-queue",
                    "/users/**",
                    "/user-center",
                    "/login",
                    "/register",
                    "/profile",
                    "/semi-test"
                ).permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").hasRole("SUPER_ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/v1/home/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/problems/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/practices/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/contests/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/contests/public/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/clics/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/contests/*/rank").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/contests/*/scoreboard/snapshot/*").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/users/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/leaderboard/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/announcements/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/settings/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/submissions").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/submission-queue/**", "/api/submission-queue/**").permitAll()
                .requestMatchers("/api/admin/v1/users/**").hasRole("SUPER_ADMIN")
                .requestMatchers("/api/admin/v1/classes/**").hasRole("SUPER_ADMIN")
                .requestMatchers("/api/admin/v1/teachers/**").hasRole("SUPER_ADMIN")
                .requestMatchers("/api/admin/v1/settings/**").hasRole("SUPER_ADMIN")
                .requestMatchers("/api/teacher/v1/**").hasRole("TEACHER")
                .requestMatchers("/api/admin/v1/**").hasAnyRole("SUPER_ADMIN", "TEACHER")
                .anyRequest().authenticated()
            )
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint((request, response, authException) ->
                    writeJson(response, HttpServletResponse.SC_UNAUTHORIZED, ApiResponse.fail(401, "未登录"))
                )
                .accessDeniedHandler((request, response, accessDeniedException) ->
                    writeJson(response, HttpServletResponse.SC_FORBIDDEN, ApiResponse.fail(403, "无访问权限"))
                )
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        return request -> {
            CorsConfiguration configuration = new CorsConfiguration();
            configuration.setAllowedOrigins(configuredAllowedOrigins());
            configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
            configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-CSRF-Token"));
            configuration.setAllowCredentials(true);
            return configuration;
        };
    }

    private List<String> configuredAllowedOrigins() {
        return properties.getCors().getAllowedOrigins().stream()
            .filter(origin -> origin != null && !origin.isBlank())
            .map(String::trim)
            .distinct()
            .toList();
    }

    private void writeJson(HttpServletResponse response, int status, ApiResponse<Void> body) throws java.io.IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
