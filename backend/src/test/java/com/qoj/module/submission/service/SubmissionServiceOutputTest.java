package com.qoj.module.submission.service;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Verifies that sandbox output always fits the existing MySQL TEXT column. */
class SubmissionServiceOutputTest {

    /**
     * 封装keepsSmallOutputUnchanged相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void keepsSmallOutputUnchanged() {
        assertEquals("42\n", SubmissionService.limitSandboxOutput("42\n"));
    }

    /**
     * 封装truncatesUtf8OutputWithoutBreakingMultibyteCharacters相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void truncatesUtf8OutputWithoutBreakingMultibyteCharacters() {
        String result = SubmissionService.limitSandboxOutput("测".repeat(30000));

        assertTrue(result.getBytes(StandardCharsets.UTF_8).length <= 60 * 1024);
        assertTrue(result.endsWith("\n... (truncated)"));
        assertFalse(result.contains("\uFFFD"));
    }
}
