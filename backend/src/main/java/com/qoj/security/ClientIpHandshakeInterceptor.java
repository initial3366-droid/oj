package com.qoj.security;

import com.qoj.common.util.IpNetworkUtils;
import java.net.InetSocketAddress;
import java.util.Map;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/** Carries the validated peer IP from the WebSocket handshake into STOMP session attributes. */
@Component
public class ClientIpHandshakeInterceptor implements HandshakeInterceptor {
    @Override
    public boolean beforeHandshake(
        ServerHttpRequest request,
        ServerHttpResponse response,
        WebSocketHandler wsHandler,
        Map<String, Object> attributes
    ) {
        String realIp = request.getHeaders().getFirst("X-Real-IP");
        String clientIp = IpNetworkUtils.isIpLiteral(realIp)
            ? IpNetworkUtils.normalizeIpLiteral(realIp)
            : normalizeRemoteAddress(request.getRemoteAddress());
        attributes.put("clientIp", clientIp);
        return true;
    }

    @Override
    public void afterHandshake(
        ServerHttpRequest request,
        ServerHttpResponse response,
        WebSocketHandler wsHandler,
        Exception exception
    ) {
        // No post-handshake cleanup is required.
    }

    private String normalizeRemoteAddress(InetSocketAddress remoteAddress) {
        if (remoteAddress == null || remoteAddress.getAddress() == null) {
            return null;
        }
        String value = remoteAddress.getAddress().getHostAddress();
        return IpNetworkUtils.normalizeIpLiteral(value);
    }
}
