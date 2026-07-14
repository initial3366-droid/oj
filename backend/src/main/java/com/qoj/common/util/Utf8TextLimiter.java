package com.qoj.common.util;

import java.nio.charset.StandardCharsets;

/** Limits persisted text by UTF-8 bytes without splitting a multibyte character. */
public final class Utf8TextLimiter {
    /** Leave roughly 4 KiB below MySQL TEXT's 65,535-byte storage limit. */
    public static final int MYSQL_TEXT_SAFE_BYTES = 60 * 1024;
    private static final String TRUNCATED_SUFFIX = "\n... (truncated)";

    /**
     * 构造 Utf8TextLimiter 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private Utf8TextLimiter() {
    }

    /**
     * 封装fitMysqlText相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String fitMysqlText(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        if (bytes.length <= MYSQL_TEXT_SAFE_BYTES) {
            return value;
        }

        byte[] suffix = TRUNCATED_SUFFIX.getBytes(StandardCharsets.UTF_8);
        int end = MYSQL_TEXT_SAFE_BYTES - suffix.length;
        // UTF-8 continuation bytes cannot begin the retained prefix.
        while (end > 0 && (bytes[end] & 0xC0) == 0x80) {
            end--;
        }
        /**
         * 封装String相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new String(bytes, 0, end, StandardCharsets.UTF_8) + TRUNCATED_SUFFIX;
    }
}
