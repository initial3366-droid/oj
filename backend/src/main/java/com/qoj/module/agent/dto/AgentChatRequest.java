package com.qoj.module.agent.dto;

public record AgentChatRequest(
    String message,
    Long problemId,
    Long contestId,
    Long contestProblemId,
    String language,
    String code,
    Long submissionId
) {}
