package com.qoj.security;

import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import java.net.InetAddress;
import java.net.URI;

public final class SafeUrlValidator {
    private SafeUrlValidator() {
    }

    public static URI requirePublicHttpUrl(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "不能为空");
        }
        try {
            URI uri = URI.create(value.trim());
            String scheme = uri.getScheme();
            if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
                throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "只允许 http/https 地址");
            }
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "地址缺少主机名");
            }
            String normalizedHost = host.toLowerCase();
            if ("localhost".equals(normalizedHost) || normalizedHost.endsWith(".localhost")) {
                throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "不允许指向 localhost");
            }
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (isUnsafeAddress(address)) {
                    throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "不允许指向内网、本机或保留地址");
                }
            }
            return uri;
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "必须是有效 URL");
        }
    }

    private static boolean isUnsafeAddress(InetAddress address) {
        return address.isAnyLocalAddress()
            || address.isLoopbackAddress()
            || address.isLinkLocalAddress()
            || address.isSiteLocalAddress()
            || address.isMulticastAddress();
    }
}
