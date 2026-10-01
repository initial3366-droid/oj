package com.qojagent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** Delegates user-token verification and account-role checks to the QOJ backend. */
@Component
public class AgentAuthClient {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${qoj.base-url:}")
    private String qojBaseUrl;
    @Value("${qoj.internal-token:}")
    private String internalToken;

    public AgentAuthClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public void requireAdmin(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ") || authorization.length() <= 7) {
            throw new AgentException(401, "请先登录后台");
        }
        if (qojBaseUrl == null || qojBaseUrl.isBlank() || internalToken == null || internalToken.isBlank()) {
            throw new AgentException(503, "Agent 与 QOJ 后端认证未配置");
        }
        try {
            URI uri = URI.create(qojBaseUrl.replaceAll("/+$", "") + "/api/internal/agent/authorize");
            HttpRequest request = HttpRequest.newBuilder(uri)
                .header("Authorization", authorization)
                .header("X-Agent-Token", internalToken)
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode envelope;
            try {
                envelope = objectMapper.readTree(response.body());
            } catch (Exception e) {
                throw new AgentException(503, "QOJ 后端认证服务未返回有效响应");
            }
            if (response.statusCode() == 401) throw new AgentException(401, "后台登录状态已过期");
            if (response.statusCode() == 403) throw new AgentException(403, "无权使用 AI 控制台");
            if (response.statusCode() < 200 || response.statusCode() >= 300 || envelope.path("code").asInt() != 200) {
                throw new AgentException(503, "QOJ 后端认证服务暂时不可用");
            }
            if (!envelope.path("data").asBoolean(false)) throw new AgentException(403, "无权使用 AI 控制台");
        } catch (AgentException e) {
            throw e;
        } catch (Exception e) {
            throw new AgentException(503, "无法连接 QOJ 后端认证服务");
        }
    }
}
