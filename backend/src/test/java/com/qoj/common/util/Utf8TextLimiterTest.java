package com.qoj.common.util;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Utf8TextLimiter测试类。验证关键业务规则、异常边界及回归场景。
 */
class Utf8TextLimiterTest {
    /**
     * 封装keepsTextThatAlreadyFits相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void keepsTextThatAlreadyFits() {
        assertEquals("判题完成", Utf8TextLimiter.fitMysqlText("判题完成"));
    }

    /**
     * 封装truncatesCjkAndEmojiOnUtf8CharacterBoundaries相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void truncatesCjkAndEmojiOnUtf8CharacterBoundaries() {
        String value = "判🙂".repeat(12000);

        String result = Utf8TextLimiter.fitMysqlText(value);

        assertTrue(result.getBytes(StandardCharsets.UTF_8).length
            <= Utf8TextLimiter.MYSQL_TEXT_SAFE_BYTES);
        assertTrue(result.endsWith("\n... (truncated)"));
        assertFalse(result.contains("\uFFFD"));
    }
}
