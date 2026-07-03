package com.qoj.module.agent.vo;

public record AgentChatResponse(
    String reply,
    String model,
    String requestId
) {}
