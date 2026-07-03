package com.qoj.module.agent.vo;

public record AgentQuotaVO(
    int dailyLimit,
    int used,
    int remaining
) {}
