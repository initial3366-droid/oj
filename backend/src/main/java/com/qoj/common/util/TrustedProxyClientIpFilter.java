package com.qoj.common.util;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Trust client IP headers only from explicitly configured reverse proxy networks. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TrustedProxyClientIpFilter extends OncePerRequestFilter {
    private final String trustedProxyRanges;

    public TrustedProxyClientIpFilter(@Value("${qoj.trusted-proxy-ranges:}") String ranges) {
        this.trustedProxyRanges = IpNetworkUtils.normalizeRanges(ranges);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                   FilterChain chain) throws ServletException, IOException {
        if (trustedProxyRanges != null
            && IpNetworkUtils.isAllowed(trustedProxyRanges, request.getRemoteAddr())) {
            String address = IpNetworkUtils.normalizeIpLiteral(request.getHeader("X-Real-IP"));
            // Invalid or absent proxy headers deliberately fail closed for restricted contests.
            request.setAttribute(IpNetworkUtils.class.getName() + ".clientIp",
                address == null ? "invalid" : address);
        }
        chain.doFilter(request, response);
    }
}
