package com.qoj.module.judge;

import java.util.Locale;

/** Applies the published C/C++ and non-native-language resource-limit policy. */
public final class JudgeResourceLimits {
    private static final int NON_NATIVE_LANGUAGE_MULTIPLIER = 2;

    private JudgeResourceLimits() {
    }

    public static Limits forLanguage(String language, int timeLimitMs, int memoryLimitMb) {
        if (isCOrCpp(language)) {
            return new Limits(timeLimitMs, memoryLimitMb);
        }
        return new Limits(
            Math.multiplyExact(timeLimitMs, NON_NATIVE_LANGUAGE_MULTIPLIER),
            Math.multiplyExact(memoryLimitMb, NON_NATIVE_LANGUAGE_MULTIPLIER)
        );
    }

    private static boolean isCOrCpp(String language) {
        String normalized = language == null ? "" : language.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "c", "cpp", "c++", "cxx", "g++" -> true;
            default -> false;
        };
    }

    public record Limits(int timeLimitMs, int memoryLimitMb) {
    }
}
