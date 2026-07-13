package com.qoj.security;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtAuthenticationFilter security behavior")
class JwtAuthenticationFilterTest {
    private static final String SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Mock
    private JwtService jwtService;
    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;
    @Mock
    private UserMapper userMapper;
    @Mock
    private AdminUserMapper adminUserMapper;

    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(jwtService, redisTemplate, userMapper, adminUserMapper);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Refresh token must not authenticate HTTP requests")
    void refreshToken_ShouldNotAuthenticateRequest() throws Exception {
        String refreshToken = signedToken("42", "SUPER_ADMIN", "USER", "refresh");
        when(jwtService.parse(refreshToken)).thenReturn(Jwts.parser()
            .verifyWith(signingKey())
            .build()
            .parseSignedClaims(refreshToken)
            .getPayload());

        doFilter(refreshToken);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verifyNoInteractions(redisTemplate, userMapper, adminUserMapper);
    }

    @Test
    @DisplayName("Authorities must be loaded from database instead of JWT role claim")
    void accessToken_ShouldLoadAuthoritiesFromDatabase() throws Exception {
        String accessToken = signedToken("42", "SUPER_ADMIN", "USER", "access");
        User databaseUser = new User();
        databaseUser.id = 42L;
        databaseUser.username = "student";
        databaseUser.passwordHash = "encoded";
        databaseUser.role = "STUDENT";
        databaseUser.displayName = "Student";

        when(jwtService.parse(accessToken)).thenReturn(Jwts.parser()
            .verifyWith(signingKey())
            .build()
            .parseSignedClaims(accessToken)
            .getPayload());
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        when(userMapper.selectOne(any(Wrapper.class))).thenReturn(databaseUser);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        doFilter(accessToken);

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(authentication);
        AuthUser principal = (AuthUser) authentication.getPrincipal();
        assertEquals("STUDENT", principal.role());
        assertTrue(authentication.getAuthorities().stream()
            .anyMatch(authority -> "ROLE_STUDENT".equals(authority.getAuthority())));
        verify(userMapper).selectOne(any(Wrapper.class));
        verify(adminUserMapper, never()).selectById(any());
    }

    private void doFilter(String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
    }

    private String signedToken(String subject, String role, String accountType, String tokenType) {
        Instant now = Instant.now();
        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(subject)
            .claim("username", "jwt-user")
            .claim("displayName", "JWT User")
            .claim("role", role)
            .claim("typ", tokenType)
            .claim("accountType", accountType)
            .claim("userId", Long.valueOf(subject))
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(3600)))
            .signWith(signingKey())
            .compact();
    }

    private SecretKey signingKey() {
        return Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    }
}
