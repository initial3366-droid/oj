package com.qoj.security;

import com.qoj.common.redis.RedisKeys;
import com.qoj.module.user.service.UserStatusChangedEvent;
import java.io.IOException;
import java.util.Map;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;

/** Tracks native and SockJS transports so a committed ban closes existing sessions. */
@Component
public class UserSocketSessions implements WebSocketHandlerDecoratorFactory {
    private static final Logger log = LoggerFactory.getLogger(UserSocketSessions.class);
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final StringRedisTemplate redis;

    public UserSocketSessions(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public WebSocketHandler decorate(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                sessions.put(session.getId(), session);
                try {
                    super.afterConnectionEstablished(session);
                } catch (Exception error) {
                    sessions.remove(session.getId());
                    throw error;
                }
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                sessions.remove(session.getId());
                super.afterConnectionClosed(session, status);
            }
        };
    }

    public void reject(String sessionId) {
        reject(sessionId, "Account banned");
    }

    /** Closes both native and SockJS sessions after an inbound policy violation. */
    public void reject(String sessionId, String reason) {
        WebSocketSession session = sessions.get(sessionId);
        if (session == null) return;
        try {
            session.close(CloseStatus.POLICY_VIOLATION.withReason(reason));
        } catch (IOException error) {
            log.warn("Failed to close rejected socket {}", sessionId, error);
        }
    }

    @TransactionalEventListener
    public void statusChanged(UserStatusChangedEvent event) {
        if (!"BANNED".equals(event.status())) return;
        try {
            redis.delete(List.of(RedisKeys.onlineUser(event.userId()), RedisKeys.onlineAccount("USER", event.userId())));
        } catch (RuntimeException error) {
            log.warn("Failed to clear online status for banned user {}", event.userId(), error);
        }
        for (WebSocketSession session : sessions.values()) {
            if (session.getAttributes().get("authUser") instanceof AuthUser actor
                && "USER".equals(actor.accountType()) && actor.id().equals(event.userId())) {
                reject(session.getId());
            }
        }
    }
}
