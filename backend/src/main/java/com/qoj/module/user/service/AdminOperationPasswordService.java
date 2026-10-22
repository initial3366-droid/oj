package com.qoj.module.user.service;

import com.qoj.common.exception.BizException;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/** Per-operation confirmation for privileged student administration. Never log the input. */
@Service
public class AdminOperationPasswordService {
    private static final String PASSWORD_HASH = "$2b$12$yM9QNHPo2usjk/3F1/1nTOZOycCeJoM0m2j328jbsLVgGBX0Put32";
    private static final DefaultRedisScript<Long> RESERVE_ATTEMPT = new DefaultRedisScript<>("""
        local count = tonumber(redis.call('GET', KEYS[1]) or '0')
        if count >= 5 then return 0 end
        count = redis.call('INCR', KEYS[1])
        if count == 1 then redis.call('EXPIRE', KEYS[1], 300) end
        return 1
        """, Long.class);
    private final PasswordEncoder passwords;
    private final StringRedisTemplate redis;

    public AdminOperationPasswordService(PasswordEncoder passwords, StringRedisTemplate redis) {
        this.passwords = passwords;
        this.redis = redis;
    }

    public void verify(String password) {
        AuthUser actor = CurrentUser.required();
        if (!actor.isAdmin()) throw new BizException(403, "仅超级管理员可以执行此操作");
        String key = "oj:admin:operation-password:attempts:" + actor.id();
        // Reserve atomically before the expensive hash check. Redis failures never authorize a mutation.
        Long allowed = redis.execute(RESERVE_ATTEMPT, List.of(key));
        if (!Long.valueOf(1).equals(allowed)) throw new BizException(429, "操作密码尝试过于频繁，请 5 分钟后重试");
        if (password == null || password.isBlank() || password.getBytes(StandardCharsets.UTF_8).length > 72
            || !passwords.matches(password, PASSWORD_HASH)) {
            throw new BizException(403, "超级管理员操作密码错误");
        }
        redis.delete(key);
    }
}
