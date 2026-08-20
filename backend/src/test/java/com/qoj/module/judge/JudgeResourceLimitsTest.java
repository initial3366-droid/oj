package com.qoj.module.judge;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JudgeResourceLimitsTest {
    @Test
    void cAndCppKeepThePublishedLimits() {
        assertLimits("c", 1000, 256, 1000, 256);
        assertLimits("C++", 1000, 256, 1000, 256);
        assertLimits("g++", 1000, 256, 1000, 256);
    }

    @Test
    void nonNativeLanguagesReceiveDoubleLimits() {
        assertLimits("python", 1000, 256, 2000, 512);
        assertLimits("java", 1000, 256, 2000, 512);
    }

    private void assertLimits(
        String language,
        int timeLimitMs,
        int memoryLimitMb,
        int expectedTimeLimitMs,
        int expectedMemoryLimitMb
    ) {
        JudgeResourceLimits.Limits limits = JudgeResourceLimits.forLanguage(
            language, timeLimitMs, memoryLimitMb);
        assertEquals(expectedTimeLimitMs, limits.timeLimitMs());
        assertEquals(expectedMemoryLimitMb, limits.memoryLimitMb());
    }
}
