package com.qoj.module.auth.service;

import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

/** One atomic attempt budget and single-use redemption for every email-code consumer. */
final class EmailVerificationCodes {
    private static final DefaultRedisScript<Long> VERIFY = new DefaultRedisScript<>("""
        local code = redis.call('GET', KEYS[1])
        if not code then return 0 end
        if code == ARGV[1] then
            redis.call('DEL', KEYS[1], KEYS[2])
            return 1
        end
        local failures = redis.call('INCR', KEYS[2])
        redis.call('PEXPIRE', KEYS[2], math.max(1, redis.call('PTTL', KEYS[1])))
        if failures >= 5 then redis.call('DEL', KEYS[1], KEYS[2]) end
        return 0
        """, Long.class);

    private EmailVerificationCodes() { }

    static void consume(StringRedisTemplate redis, String email, String code) {
        Long result = redis.execute(VERIFY,
            List.of(RedisKeys.emailVerificationCode(email), attemptsKey(email)), code == null ? "" : code);
        if (!Long.valueOf(1).equals(result)) throw new BizException(400, "邮箱验证码无效或已过期，请重新获取");
    }

    static String attemptsKey(String email) {
        return RedisKeys.emailVerificationCode(email) + ":attempts";
    }
}
