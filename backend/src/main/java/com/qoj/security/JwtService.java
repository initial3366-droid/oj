package com.qoj.security;

import com.qoj.config.QojProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

/**
 * JWT 令牌签发与验证服务。
 *
 * 双令牌体系：Access Token（短期，默认15分钟）+ Refresh Token（长期，默认7天）。
 * Token Family 机制：每次刷新产生新 refresh token 但共享 familyId，用于检测重放攻击。
 * 签名算法：HMAC-SHA，Keys.hmacShaKeyFor 根据密钥长度自动选择 HS256/HS384/HS512。
 */
@Service
public class JwtService {
    private final QojProperties properties;
    // HMAC-SHA 签名密钥，由配置的 jwt.secret 派生，长度决定算法强度
    private final SecretKey key;

    /**
     * 构造 JwtService 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public JwtService(QojProperties properties) {
        this.properties = properties;
        this.key = Keys.hmacShaKeyFor(properties.getJwt().getSecret().getBytes(StandardCharsets.UTF_8));
    }

    /** 签发全新令牌对（access + refresh），生成新的 familyId */
    public TokenPair issueTokens(AuthUser user) {
        String familyId = UUID.randomUUID().toString();
        /**
         * 构造 令牌Pair 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new TokenPair(
            issueToken(user, properties.getJwt().getAccessTokenTtlSeconds(), "access", null),
            issueToken(user, properties.getJwt().getRefreshTokenTtlSeconds(), "refresh", familyId),
            familyId
        );
    }

    /** 仅签发 Access Token，用于 refresh 续期流程 */
    public String issueAccessToken(AuthUser user) {
        /**
         * 判断sue令牌是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return issueToken(user, properties.getJwt().getAccessTokenTtlSeconds(), "access", null);
    }

    /** 在已有 family 中签发新 Refresh Token，实现令牌轮换 */
    public String issueRefreshToken(AuthUser user, String familyId) {
        /**
         * 判断sue令牌是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return issueToken(user, properties.getJwt().getRefreshTokenTtlSeconds(), "refresh", familyId);
    }

    /**
     * 统一令牌构造方法。
     * @param user 认证用户信息
     * @param ttlSeconds 有效期（秒）
     * @param tokenType "access" 或 "refresh"
     * @param familyId 刷新家族 ID，仅 refresh 类型携带
     *
     * JWT 载荷字段：jti（唯一标识）、sub（用户ID）、username、displayName、
     * role、typ（令牌类型）、accountType（ADMIN/USER）、userId
     */
    private String issueToken(AuthUser user, long ttlSeconds, String tokenType, String familyId) {
        Instant now = Instant.now();
        var builder = Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(String.valueOf(user.id()))
            .claim("username", user.getUsername())
            .claim("displayName", user.displayName())
            .claim("role", user.role())
            .claim("typ", tokenType)
            .claim("accountType", user.adminAccount() ? "ADMIN" : "USER")
            .claim("userId", user.id())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(ttlSeconds)))
            .signWith(key);

        // familyId 仅对 refresh 令牌生效，access 令牌不携带此字段
        if (familyId != null && "refresh".equals(tokenType)) {
            builder.claim("familyId", familyId);
        }

        return builder.compact();
    }

    /** 解析并验证 JWT 令牌字符串，验签失败或过期会抛出异常 */
    public Claims parse(String token) {
        return Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    /**
     * 令牌剩余有效秒数。
     * 保底返回 1：避免刚过期的令牌返回 0 或负数，导致调度逻辑异常。
     */
    public long remainingSeconds(Claims claims) {
        long seconds = (claims.getExpiration().getTime() - System.currentTimeMillis()) / 1000;
        return Math.max(seconds, 1);
    }

    /**
     * 封装refresh令牌TtlSeconds相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public long refreshTokenTtlSeconds() {
        return properties.getJwt().getRefreshTokenTtlSeconds();
    }

    /** 令牌对记录 */
    public record TokenPair(String accessToken, String refreshToken, String familyId) {
    }
}
