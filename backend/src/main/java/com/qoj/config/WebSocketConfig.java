package com.qoj.config;

import com.qoj.security.WebSocketAuthInterceptor;
import com.qoj.security.WebSocketSubscriptionInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket / STOMP 消息代理配置。
 *
 * 架构说明：
 * - 客户端通过 /ws（原生 WebSocket）或 /ws-sockjs（SockJS 降级）连接
 * - 使用 Spring 内置简易消息代理（SimpleBroker），无需外部消息队列
 * - /topic 前缀 → 广播消息（比赛榜单、判题队列刷新）
 * - /user 前缀 → 点对点私信（个人提交状态变更）
 * - /app 前缀 → 客户端发往服务端的消息路由前缀
 *
 * 拦截链路：连接 → WebSocketAuthInterceptor → STOMP → WebSocketSubscriptionInterceptor → 消息分发
 *
 * 限制：SimpleBroker 仅支持单实例，多实例部署需升级为外部 STOMP broker（如 RabbitMQ）
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final WebSocketAuthInterceptor authInterceptor;
    private final WebSocketSubscriptionInterceptor subscriptionInterceptor;
    private final QojProperties qojProperties;

    public WebSocketConfig(
        WebSocketAuthInterceptor authInterceptor,
        WebSocketSubscriptionInterceptor subscriptionInterceptor,
        QojProperties qojProperties
    ) {
        this.authInterceptor = authInterceptor;
        this.subscriptionInterceptor = subscriptionInterceptor;
        this.qojProperties = qojProperties;
    }

    /** 消息代理拓扑：注册 /topic 广播 + /user 私信前缀，设置客户端发信路由 */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/user");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    /**
     * STOMP 端点注册。
     * /ws：原生 WebSocket（现代浏览器）
     * /ws-sockjs：SockJS 降级（长轮询/流式，兼容旧浏览器）
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] allowedOrigins = qojProperties.getCors().getAllowedOrigins().toArray(new String[0]);
        registry.addEndpoint("/ws")
            .setAllowedOrigins(allowedOrigins);
        registry.addEndpoint("/ws-sockjs")
            .setAllowedOrigins(allowedOrigins)
            .withSockJS();
    }

    /** 入站拦截器注册，authInterceptor 必须在 subscriptionInterceptor 之前执行 */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authInterceptor, subscriptionInterceptor);
    }
}
