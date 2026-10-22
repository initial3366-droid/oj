package com.qoj.common.util;

import jakarta.servlet.http.HttpServletRequest;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Utilities for parsing CIDR networks and reading the client address from a request. */
public final class IpNetworkUtils {
    private IpNetworkUtils() {
    }

    /**
     * Return the direct peer address unless the configured trusted proxy filter resolved it.
     */
    public static String currentClientIp() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
            return null;
        }
        return clientIp(attributes.getRequest());
    }

    public static String clientIp(HttpServletRequest request) {
        Object resolved = request.getAttribute(IpNetworkUtils.class.getName() + ".clientIp");
        if (resolved instanceof String address) {
            return normalizeIpLiteral(address);
        }
        String remoteAddress = request.getRemoteAddr();
        return isIpLiteral(remoteAddress) ? normalizeIpLiteral(remoteAddress) : null;
    }

    /** Normalize a line/comma/semicolon separated CIDR list; an empty list means unrestricted. */
    public static String normalizeRanges(String ranges) {
        if (ranges == null || ranges.isBlank()) {
            return null;
        }
        List<String> normalized = new ArrayList<>();
        for (String item : ranges.split("[,;\\r\\n]+")) {
            String network = item.trim();
            if (network.isEmpty()) {
                continue;
            }
            parseNetwork(network);
            normalized.add(network);
        }
        return normalized.isEmpty() ? null : String.join("\n", normalized);
    }

    public static boolean isAllowed(String ranges, String clientIp) {
        if (ranges == null || ranges.isBlank()) {
            return true;
        }
        byte[] address = parseAddress(clientIp);
        if (address == null) {
            return false;
        }
        try {
            for (String item : ranges.split("[,;\\r\\n]+")) {
                String network = item.trim();
                if (!network.isEmpty() && contains(parseNetwork(network), address)) {
                    return true;
                }
            }
        } catch (IllegalArgumentException ignored) {
            // A malformed stored rule must fail closed.
        }
        return false;
    }

    public static boolean isIpLiteral(String value) {
        return parseAddress(value) != null;
    }

    public static String normalizeIpLiteral(String value) {
        byte[] address = parseAddress(value);
        if (address == null) {
            return null;
        }
        try {
            return InetAddress.getByAddress(address).getHostAddress();
        } catch (UnknownHostException ignored) {
            return null;
        }
    }

    private static Network parseNetwork(String value) {
        int slash = value.indexOf('/');
        if (slash <= 0 || slash != value.lastIndexOf('/')) {
            throw new IllegalArgumentException("CIDR 网段必须包含一个 / 前缀长度");
        }
        String literal = value.substring(0, slash).trim();
        byte[] address = parseAddress(literal);
        if (address == null) {
            throw new IllegalArgumentException("IP 地址格式无效");
        }
        String prefixText = value.substring(slash + 1).trim();
        if (!prefixText.matches("\\d{1,3}")) {
            throw new IllegalArgumentException("CIDR 前缀长度无效");
        }
        int prefix = Integer.parseInt(prefixText);
        if (prefix < 0 || prefix > address.length * 8) {
            throw new IllegalArgumentException("CIDR 前缀长度超出范围");
        }
        if (prefix == address.length * 8) {
            throw new IllegalArgumentException("请填写 IP 网段，不能填写单个 IP 地址");
        }
        return new Network(address, prefix);
    }

    private static byte[] parseAddress(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String literal = value.trim();
        int scopeSeparator = literal.indexOf('%');
        if (scopeSeparator >= 0) {
            literal = literal.substring(0, scopeSeparator);
        }
        if (literal.matches("(?:\\d{1,3}\\.){3}\\d{1,3}")) {
            String[] octets = literal.split("\\.");
            byte[] address = new byte[4];
            for (int i = 0; i < octets.length; i++) {
                int octet = Integer.parseInt(octets[i]);
                if (octet > 255) {
                    return null;
                }
                address[i] = (byte) octet;
            }
            return address;
        }
        if (!literal.matches("[0-9A-Fa-f:]+") || !literal.contains(":")) {
            return null;
        }
        try {
            InetAddress address = InetAddress.getByName(literal);
            return address instanceof Inet6Address ? address.getAddress() : null;
        } catch (UnknownHostException ignored) {
            return null;
        }
    }

    private static boolean contains(Network network, byte[] address) {
        if (network.address.length != address.length) {
            return false;
        }
        int wholeBytes = network.prefix / 8;
        int remainingBits = network.prefix % 8;
        for (int i = 0; i < wholeBytes; i++) {
            if (network.address[i] != address[i]) {
                return false;
            }
        }
        if (remainingBits == 0) {
            return true;
        }
        int mask = 0xff << (8 - remainingBits);
        return (network.address[wholeBytes] & mask) == (address[wholeBytes] & mask);
    }

    private record Network(byte[] address, int prefix) {
    }
}
