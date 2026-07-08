package com.qoj.module.auth.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.qoj.common.exception.BizException;
import com.qoj.config.QojProperties;
import com.qoj.module.auth.dto.AuthTokenResponse;
import com.qoj.module.auth.dto.LoginRequest;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.mapper.UserScoreMapper;
import com.qoj.security.JwtService;
import io.jsonwebtoken.Claims;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService Tests")
class AuthServiceTest {
    @Mock
    private UserMapper userMapper;
    @Mock
    private AdminUserMapper adminUserMapper;
    @Mock
    private UserScoreMapper userScoreMapper;
    @Mock
    private ClassMemberMapper classMemberMapper;
    @Mock
    private PasswordEncoder passwordEncoder;
    private JwtService jwtService;
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        QojProperties properties = new QojProperties();
        properties.getJwt().setSecret("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
        properties.getJwt().setAccessTokenTtlSeconds(3600);
        properties.getJwt().setRefreshTokenTtlSeconds(86400);
        jwtService = new JwtService(properties);
        redisTemplate = new StubStringRedisTemplate(valueOperations);
        authService = new AuthService(
            userMapper,
            adminUserMapper,
            userScoreMapper,
            null,
            classMemberMapper,
            passwordEncoder,
            jwtService,
            redisTemplate
        );
    }

    @Test
    @DisplayName("Frontend login: admin_users TEACHER role should sync to users and issue USER token")
    void loginUser_TeacherAdminAccount_ShouldIssueFrontendToken() {
        AdminUser adminUser = new AdminUser();
        adminUser.id = 8L;
        adminUser.username = "teacher";
        adminUser.passwordHash = "encoded";
        adminUser.role = "TEACHER";
        adminUser.displayName = "Teacher";
        adminUser.email = "teacher@example.com";

        when(userMapper.selectOne(any(Wrapper.class))).thenReturn(null);
        when(adminUserMapper.selectOne(any(Wrapper.class))).thenReturn(adminUser);
        when(passwordEncoder.matches("secret", "encoded")).thenReturn(true);
        when(userMapper.selectCount(any(Wrapper.class))).thenReturn(0L);
        doAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.id = 100L;
            return 1;
        }).when(userMapper).insert(any(User.class));
        when(userScoreMapper.selectById(100L)).thenReturn(null);

        AuthTokenResponse response = authService.loginUser(new LoginRequest("teacher", "secret", null, null));

        Claims claims = jwtService.parse(response.accessToken());
        assertEquals("100", claims.getSubject());
        assertEquals("USER", claims.get("accountType", String.class));
        assertEquals("TEACHER", claims.get("role", String.class));
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(userCaptor.capture());
        User syncedUser = userCaptor.getValue();
        assertEquals("teacher", syncedUser.username);
        assertEquals("encoded", syncedUser.passwordHash);
        assertEquals("TEACHER", syncedUser.role);
        assertEquals("Teacher", syncedUser.displayName);
        verify(valueOperations).set(any(String.class), eq("1"), any(Duration.class));
    }

    @Test
    @DisplayName("Frontend login: admin_users SUPER_ADMIN should still be rejected")
    void loginUser_SuperAdminAdminAccount_ShouldRejectFrontendLogin() {
        AdminUser adminUser = new AdminUser();
        adminUser.id = 1L;
        adminUser.username = "admin";
        adminUser.passwordHash = "encoded";
        adminUser.role = "SUPER_ADMIN";

        when(userMapper.selectOne(any(Wrapper.class))).thenReturn(null);
        when(adminUserMapper.selectOne(any(Wrapper.class))).thenReturn(adminUser);
        when(passwordEncoder.matches("admin123", "encoded")).thenReturn(true);

        BizException exception = assertThrows(
            BizException.class,
            () -> authService.loginUser(new LoginRequest("admin", "admin123", null, null))
        );

        assertEquals(403, exception.getCode());
        assertTrue(exception.getMessage().contains("后台账号请从后台入口登录"));
    }

    private static final class StubStringRedisTemplate extends StringRedisTemplate {
        private final ValueOperations<String, String> valueOperations;

        private StubStringRedisTemplate(ValueOperations<String, String> valueOperations) {
            this.valueOperations = valueOperations;
        }

        @Override
        public ValueOperations<String, String> opsForValue() {
            return valueOperations;
        }

        @Override
        public Boolean delete(String key) {
            return true;
        }
    }
}
