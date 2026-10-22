package com.qoj.module.agent.service;

/** Bounded long-running administrator tasks; transport leases must outlive a segment. */
public final class AgentExecutionLimits {
    public static final long MIN_IDLE_TIMEOUT_MS = 300_000L;
    public static final long MODEL_TIMEOUT_MS = 600_000L;
    public static final long SEGMENT_TIMEOUT_MS = 900_000L;
    public static final long LEASE_TIMEOUT_MS = 1_200_000L;
    public static final int MAX_TOOL_CALLS = 256;
    public static final int MAX_ROUNDS = 200;
    public static final int MAX_REPEATED_CALLS = 16;
    public static final int MAX_OUTPUT_TOKENS = 65_536;

    private AgentExecutionLimits() {}

    public static long idleTimeoutMs(Long configured) {
        return Math.min(MODEL_TIMEOUT_MS, Math.max(MIN_IDLE_TIMEOUT_MS, configured == null ? 0L : configured));
    }
}
