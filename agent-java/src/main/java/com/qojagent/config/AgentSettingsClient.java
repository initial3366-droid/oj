package com.qojagent.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qojagent.service.AgentException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** Reads the active provider configuration from QOJ; the API key never passes through the browser. */
@Component
public class AgentSettingsClient {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${qoj.base-url:}")
    private String qojBaseUrl;
    @Value("${qoj.internal-token:}")
    private String internalToken;
    public AgentSettingsClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public AgentSettings load() {
        if (qojBaseUrl == null || qojBaseUrl.isBlank() || internalToken == null || internalToken.isBlank()) {
            throw new AgentException(503, "Agent 与 QOJ 后端内部配置未连接");
        }
        try {
            URI uri = URI.create(qojBaseUrl.replaceAll("/+$", "") + "/api/internal/agent/config");
            HttpRequest request = HttpRequest.newBuilder(uri)
                .header("Accept", "application/json")
                .header("X-Agent-Token", internalToken)
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("QOJ internal config returned HTTP " + response.statusCode());
            }
            JsonNode envelope = objectMapper.readTree(response.body());
            if (envelope.path("code").asInt() != 200 || !envelope.hasNonNull("data")) {
                throw new IllegalStateException("QOJ internal config returned an invalid response");
            }
            return objectMapper.treeToValue(envelope.get("data"), AgentSettings.class);
        } catch (Exception e) {
            if (e instanceof AgentException agentException) throw agentException;
            throw new AgentException(503, "无法读取 QOJ 后台 AI 配置");
        }
    }
}
