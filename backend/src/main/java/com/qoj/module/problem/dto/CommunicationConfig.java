package com.qoj.module.problem.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import java.nio.charset.StandardCharsets;

/** Versioned two-pass configuration. Full sources are never included in public views. */
public record CommunicationConfig(
    Boolean enabled,
    Integer version,
    Integer maxMessageBytes,
    Boolean allowEmptyMessage,
    String channelSource,
    String checkerSource
) {
    private static final ObjectMapper JSON = new ObjectMapper();
    public static final int MAX_MESSAGE_BYTES = 1_048_576;

    public CommunicationConfig validated() {
        if (!Boolean.TRUE.equals(enabled)) return null;
        if (version != null && version != 1) throw new BizException(400, "不支持的通信题配置版本");
        if (maxMessageBytes == null || maxMessageBytes < 1 || maxMessageBytes > MAX_MESSAGE_BYTES) {
            throw new BizException(400, "通信消息字节上限必须为 1 至 1048576");
        }
        if (channelSource == null || channelSource.isBlank() || checkerSource == null || checkerSource.isBlank()) {
            throw new BizException(400, "通信题必须提供信道程序和最终检查器源码");
        }
        if (channelSource.getBytes(StandardCharsets.UTF_8).length > 200_000
            || checkerSource.getBytes(StandardCharsets.UTF_8).length > 200_000) {
            throw new BizException(400, "通信题裁判源码不能超过 200000 字节");
        }
        return new CommunicationConfig(true, 1, maxMessageBytes, Boolean.TRUE.equals(allowEmptyMessage), channelSource, checkerSource);
    }

    public static String encode(CommunicationConfig config) {
        if (config == null) return null;
        CommunicationConfig normalized = config.validated();
        if (normalized == null) return null;
        try { return JSON.writeValueAsString(normalized); }
        catch (Exception e) { throw new BizException(400, "通信题配置无法保存"); }
    }

    public static CommunicationConfig decode(String value) {
        if (value == null || value.isBlank()) return null;
        try { return JSON.readValue(value, CommunicationConfig.class).validated(); }
        catch (Exception e) { throw new BizException(500, "通信题配置损坏，请管理员重新保存"); }
    }

    public record Info(int version, String execution, int maxMessageBytes, boolean allowEmptyMessage) {}

    public static Info info(String value) {
        CommunicationConfig config = decode(value);
        return config == null ? null : new Info(1, "TWO_PASS", config.maxMessageBytes(), config.allowEmptyMessage());
    }
}
