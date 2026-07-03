package com.qoj.module.agent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.setting.vo.AgentSettingsVO;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
public class OpenAiCompatibleAgentClient implements AgentClient {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public OpenAiCompatibleAgentClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    @Override
    public String chat(AgentSettingsVO agent, String systemPrompt, String userPrompt) {
        try {
            String requestBody = objectMapper.writeValueAsString(new ChatRequest(
                agent.model,
                new Message[]{
                    new Message("system", systemPrompt),
                    new Message("user", userPrompt)
                }
            ));

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(agent.baseUrl + "/chat/completions"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + agent.apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofMillis(agent.timeoutMs))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new BizException(502, "AI 服务返回错误：" + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode choices = root.get("choices");
            if (choices == null || choices.isEmpty()) {
                throw new BizException(502, "AI 服务返回空结果");
            }

            String content = choices.get(0).get("message").get("content").asText();
            if (content == null || content.isBlank()) {
                throw new BizException(502, "AI 服务返回空内容");
            }

            return content.trim();
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw new BizException(502, "AI 服务请求失败：" + e.getMessage());
        }
    }

    private record ChatRequest(String model, Message[] messages) {}
    private record Message(String role, String content) {}
}
