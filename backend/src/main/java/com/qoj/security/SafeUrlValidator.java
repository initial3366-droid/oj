package com.qoj.security;

import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import java.net.InetAddress;
import java.net.URI;

/**
 * SafeUrlValidator领域类型。封装 qoj.security 模块内的相关职责。
 */
public final class SafeUrlValidator {
    /**
     * 构造 SafeUrlValidator 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private SafeUrlValidator() {
    }

    /**
     * 校验PublicHttpUrl。不满足业务约束时直接抛出明确异常。
     */
    public static URI requirePublicHttpUrl(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "不能为空");
        }
        try {
            URI uri = URI.create(value.trim());
            String scheme = uri.getScheme();
            if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "只允许 http/https 地址");
            }
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "地址缺少主机名");
            }
            String normalizedHost = host.toLowerCase();
            if ("localhost".equals(normalizedHost) || normalizedHost.endsWith(".localhost")) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "不允许指向 localhost");
            }
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (isUnsafeAddress(address)) {
                    /**
                     * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                     */
                    throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "不允许指向内网、本机或保留地址");
                }
            }
            return uri;
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, fieldName + "必须是有效 URL");
        }
    }

    /**
     * 判断UnsafeAddress是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private static boolean isUnsafeAddress(InetAddress address) {
        return address.isAnyLocalAddress()
            || address.isLoopbackAddress()
            || address.isLinkLocalAddress()
            || address.isSiteLocalAddress()
            || address.isMulticastAddress();
    }
}
