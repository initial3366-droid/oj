package com.qoj.module.agent.vo;

/**
 * AgentChat响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record AgentChatResponse(
    String reply,
    String model,
    String requestId
) {}
