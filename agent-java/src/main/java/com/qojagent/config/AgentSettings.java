package com.qojagent.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AgentSettings(
    Boolean enabled,
    String baseUrl,
    String apiKey,
    String model,
    String reasoningEffort,
    Long timeoutMs,
    Integer maxCodeChars
) {}
