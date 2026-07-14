package com.qoj.module.submission.service;

import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 沙箱ExecutionGuard测试类。验证关键业务规则、异常边界及回归场景。
 */
@ExtendWith(MockitoExtension.class)
class SandboxExecutionGuardTest {
    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private SandboxExecutionGuard guard;

    /**
     * 封装setUp相关逻辑。读写 Redis 中的缓存、锁或限流状态。
     */
    @BeforeEach
    void setUp() {
        guard = new SandboxExecutionGuard(redisTemplate);
    }

    /**
     * 封装acquiresAndSafelyReleases用户Lease相关逻辑。读写 Redis 中的缓存、锁或限流状态。
     */
    @Test
    @SuppressWarnings("unchecked")
    void acquiresAndSafelyReleasesUserLease() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any())).thenReturn(1L);
        when(redisTemplate.execute(
            any(RedisScript.class), anyList(), any(), any(), any(), any(), any()
        )).thenReturn(1L);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(
            eq(RedisKeys.sandboxRunLock(42L)),
            any(String.class),
            eq(Duration.ofMinutes(6))
        )).thenReturn(true);

        try (SandboxExecutionGuard.Permit ignored = guard.acquire(42L)) {
            // Holding the permit represents the single allowed in-flight run.
        }

        verify(redisTemplate, times(4)).execute(any(RedisScript.class), anyList(), any());
        /**
         * 校验前置条件。读写 Redis 中的缓存、锁或限流状态。
         */
        verify(redisTemplate).execute(
            any(RedisScript.class), anyList(), any(), any(), any(), any(), any());
    }

    /**
     * 封装rejectsRequestsOverPer用户RateLimit相关逻辑。不满足业务约束时直接抛出明确异常；读写 Redis 中的缓存、锁或限流状态。
     */
    @Test
    @SuppressWarnings("unchecked")
    void rejectsRequestsOverPerUserRateLimit() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any()))
            .thenReturn((long) SandboxExecutionGuard.MAX_RUNS_PER_MINUTE + 1);

        BizException error = assertThrows(BizException.class, () -> guard.acquire(42L));

        assertEquals(429, error.getCode());
    }

    /**
     * 封装rejectsOverlappingRunForSame用户相关逻辑。不满足业务约束时直接抛出明确异常；读写 Redis 中的缓存、锁或限流状态。
     */
    @Test
    @SuppressWarnings("unchecked")
    void rejectsOverlappingRunForSameUser() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any())).thenReturn(1L);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(any(), any(), any(Duration.class))).thenReturn(false);

        BizException error = assertThrows(BizException.class, () -> guard.acquire(42L));

        assertEquals(429, error.getCode());
    }

    /**
     * 封装rejectsWhenGlobalConcurrentSlotsAreFull相关逻辑。不满足业务约束时直接抛出明确异常；读写 Redis 中的缓存、锁或限流状态。
     */
    @Test
    @SuppressWarnings("unchecked")
    void rejectsWhenGlobalConcurrentSlotsAreFull() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any())).thenReturn(1L);
        when(redisTemplate.execute(
            any(RedisScript.class), anyList(), any(), any(), any(), any(), any()
        )).thenReturn(0L);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(any(), any(), any(Duration.class))).thenReturn(true);

        BizException error = assertThrows(BizException.class, () -> guard.acquire(42L));

        assertEquals(429, error.getCode());
    }
}
