package com.qoj.security;

import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import io.jsonwebtoken.Claims;
import java.util.Map;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * WebSocket 握手鉴权拦截器
 * 在 CONNECT 时验证 JWT Token
 */
@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {
    private final JwtService jwtService;
    private final UserMapper userMapper;
    private final AdminUserMapper adminUserMapper;

    /**
     * 构造 WebSocket认证Interceptor 实例并保存其必要依赖或初始状态。从持久化层读取数据；在状态变化后发布异步消息。
     */
    public WebSocketAuthInterceptor(
        JwtService jwtService,
        UserMapper userMapper,
        AdminUserMapper adminUserMapper
    ) {
        this.jwtService = jwtService;
        this.userMapper = userMapper;
        this.adminUserMapper = adminUserMapper;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            // 从 header 中获取 token
            String token = accessor.getFirstNativeHeader("Authorization");

            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
                try {
                    Claims claims = jwtService.parse(token);
                    String accountType = claims.get("accountType", String.class);
                    Long accountId = Long.valueOf(claims.getSubject());

                    AuthUser authUser;
                    if ("ADMIN".equals(accountType)) {
                        AdminUser adminUser = adminUserMapper.selectById(accountId);
                        if (adminUser != null) {
                            authUser = new AuthUser(adminUser);
                        } else {
                            return null; // 拒绝连接
                        }
                    } else {
                        User user = userMapper.selectById(accountId);
                        if (user != null) {
                            authUser = new AuthUser(user);
                        } else {
                            return null; // 拒绝连接
                        }
                    }

                    // 将用户信息存储到 session attributes
                    accessor.setUser(() -> String.valueOf(authUser.id()));
                    accessor.getSessionAttributes().put("authUser", authUser);

                } catch (Exception e) {
                    // Token 无效，拒绝连接
                    return null;
                }
            } else {
                // 没有 token，拒绝连接
                return null;
            }
        }

        return message;
    }
}
