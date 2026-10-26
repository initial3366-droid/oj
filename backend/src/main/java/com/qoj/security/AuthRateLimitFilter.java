package com.qoj.security;

import com.qoj.common.util.IpNetworkUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.core.Ordered;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Shared budgets cover every portal, using only the configured trusted client address. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private static final DefaultRedisScript<Long> LIMIT = new DefaultRedisScript<>("""
        for i, key in ipairs(KEYS) do
            local count = redis.call('INCR', key)
            if count == 1 or redis.call('TTL', key) < 0 then redis.call('EXPIRE', key, 60) end
            if count > tonumber(ARGV[i]) then return 0 end
        end
        return 1
        """, Long.class);
    private final StringRedisTemplate redis;
    @Value("${qoj.auth.source-limit-per-minute:120}")
    private int sourceLimitPerMinute = 120;
    @Value("${qoj.auth.email-source-limit-per-minute:20}")
    private int emailSourceLimitPerMinute = 20;
    @Value("${qoj.auth.recovery-source-limit-per-minute:20}")
    private int recoverySourceLimitPerMinute = 20;
    @Value("${qoj.auth.global-limit-per-minute:1200}")
    private int globalLimitPerMinute = 1200;

    public AuthRateLimitFilter(StringRedisTemplate redis) { this.redis = redis; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                   FilterChain chain) throws ServletException, IOException {
        String path = request.getServletPath();
        boolean login = "POST".equals(request.getMethod()) && path.endsWith("/auth/login");
        boolean captcha = path.equals("/api/v1/captcha/image");
        boolean email = path.equals("/api/v1/captcha/email");
        boolean reset = path.equals("/api/v1/auth/reset-password") || path.equals("/api/v1/auth/register");
        if (!login && !captcha && !email && !reset) { chain.doFilter(request, response); return; }
        String scope = login ? "login" : captcha ? "captcha" : email ? "email" : "recovery";
        int sourceLimit = sourceLimitPerMinute;
        if (email) {
            sourceLimit = emailSourceLimitPerMinute;
        } else if (reset) {
            // 注册与重置共享来源预算，避免交替调用扩大猜测次数。
            sourceLimit = recoverySourceLimitPerMinute;
        }
        sourceLimit = Math.max(1, sourceLimit);
        Long allowed;
        try {
            allowed = redis.execute(LIMIT, List.of("oj:auth:budget:" + scope + ":source:" + IpNetworkUtils.clientIp(request),
                "oj:auth:budget:" + scope + ":global"), String.valueOf(sourceLimit), String.valueOf(Math.max(1, globalLimitPerMinute)));
        } catch (RuntimeException ex) {
            reject(response, 503, "认证服务暂不可用，请稍后重试");
            return;
        }
        if (!Long.valueOf(1).equals(allowed)) { reject(response, 429, "操作过于频繁，请稍后重试"); return; }
        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        if (status == 429) response.setHeader("Retry-After", "60");
        response.getWriter().write("{\"code\":" + status + ",\"message\":\"" + message + "\",\"data\":null}");
    }
}
