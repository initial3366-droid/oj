package com.qoj.module.submission.service;

import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * Limits authenticated sandbox usage before a request reaches go-judge.
 *
 * <p>The fixed-window counter bounds repeated work while the token-bearing
 * lease prevents one account from running overlapping compiler processes.
 * Lease release is compare-and-delete so an expired lease can never delete a
 * newer request's token.
 */
@Component
public class SandboxExecutionGuard {
    private static final Logger log = LoggerFactory.getLogger(SandboxExecutionGuard.class);
    static final int MAX_RUNS_PER_MINUTE = 6;
    static final int MAX_GLOBAL_RUNS_PER_MINUTE = 30;
    static final int MAX_GLOBAL_CONCURRENT_RUNS = 2;
    private static final Duration RATE_WINDOW = Duration.ofMinutes(1);
    // Longer than the maximum configured go-judge HTTP timeout (300 seconds).
    private static final Duration LEASE_TTL = Duration.ofMinutes(6);
    private static final RedisScript<Long> RATE_SCRIPT = new DefaultRedisScript<>(
        "local count = redis.call('INCR', KEYS[1]); "
            + "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; "
            + "return count;",
        Long.class
    );
    private static final RedisScript<Long> RELEASE_SCRIPT = new DefaultRedisScript<>(
        "if redis.call('GET', KEYS[1]) == ARGV[1] "
            + "then return redis.call('DEL', KEYS[1]) else return 0 end;",
        Long.class
    );
    private static final RedisScript<Long> ACQUIRE_GLOBAL_SLOT_SCRIPT = new DefaultRedisScript<>(
        "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1]); "
            + "if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end; "
            + "redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4]); "
            + "redis.call('PEXPIRE', KEYS[1], ARGV[5]); return 1;",
        Long.class
    );
    private static final RedisScript<Long> RELEASE_GLOBAL_SLOT_SCRIPT = new DefaultRedisScript<>(
        "return redis.call('ZREM', KEYS[1], ARGV[1]);",
        Long.class
    );

    private final StringRedisTemplate redisTemplate;

    /**
     * 构造 沙箱ExecutionGuard 实例并保存其必要依赖或初始状态。读写 Redis 中的缓存、锁或限流状态。
     */
    public SandboxExecutionGuard(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * 封装acquire相关逻辑。不满足业务约束时直接抛出明确异常；读写 Redis 中的缓存、锁或限流状态；结果依赖当前时间。
     */
    public Permit acquire(long userId) {
        long userCount = incrementRate(RedisKeys.sandboxRunRate(userId));
        if (userCount > MAX_RUNS_PER_MINUTE) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(429, "调试运行过于频繁，请稍后再试");
        }
        long globalCount = incrementRate(RedisKeys.sandboxRunGlobalRate());
        if (globalCount > MAX_GLOBAL_RUNS_PER_MINUTE) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(429, "调试服务当前繁忙，请稍后再试");
        }

        String lockKey = RedisKeys.sandboxRunLock(userId);
        String token = UUID.randomUUID().toString();
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(lockKey, token, LEASE_TTL);
        if (!Boolean.TRUE.equals(acquired)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(429, "已有调试任务正在运行，请等待完成");
        }

        long now = System.currentTimeMillis();
        long expiresAt = now + LEASE_TTL.toMillis();
        Long globalSlot = redisTemplate.execute(
            ACQUIRE_GLOBAL_SLOT_SCRIPT,
            List.of(RedisKeys.sandboxRunGlobalSlots()),
            String.valueOf(now),
            String.valueOf(expiresAt),
            String.valueOf(MAX_GLOBAL_CONCURRENT_RUNS),
            token,
            String.valueOf(LEASE_TTL.toMillis())
        );
        if (!Long.valueOf(1L).equals(globalSlot)) {
            releaseUserLease(lockKey, token);
            if (globalSlot == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(503, "调试限流服务暂时不可用");
            }
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(429, "调试服务当前繁忙，请稍后再试");
        }
        /**
         * 构造 Permit 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new Permit(lockKey, token);
    }

    /**
     * 封装incrementRate相关逻辑。不满足业务约束时直接抛出明确异常；读写 Redis 中的缓存、锁或限流状态。
     */
    private long incrementRate(String key) {
        Long count = redisTemplate.execute(
            RATE_SCRIPT,
            List.of(key),
            String.valueOf(RATE_WINDOW.toMillis())
        );
        if (count == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(503, "调试限流服务暂时不可用");
        }
        return count;
    }

    /**
     * 封装release用户Lease相关逻辑。读写 Redis 中的缓存、锁或限流状态。
     */
    private void releaseUserLease(String lockKey, String token) {
        redisTemplate.execute(RELEASE_SCRIPT, List.of(lockKey), token);
    }

    /**
     * Permit领域类型。封装 submission.service 模块内的相关职责。
     */
    public final class Permit implements AutoCloseable {
        private final String lockKey;
        private final String token;
        private final AtomicBoolean closed = new AtomicBoolean();

        /**
         * 构造 Permit 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        private Permit(String lockKey, String token) {
            this.lockKey = lockKey;
            this.token = token;
        }

        /**
         * 封装close相关逻辑。读写 Redis 中的缓存、锁或限流状态。
         */
        @Override
        public void close() {
            if (closed.compareAndSet(false, true)) {
                try {
                    redisTemplate.execute(
                        RELEASE_GLOBAL_SLOT_SCRIPT,
                        List.of(RedisKeys.sandboxRunGlobalSlots()),
                        token
                    );
                    releaseUserLease(lockKey, token);
                } catch (RuntimeException ex) {
                    // Both leases expire automatically; do not turn a completed
                    // debug run into an API failure if Redis drops during release.
                    log.warn("Failed to release sandbox execution leases", ex);
                }
            }
        }
    }
}
