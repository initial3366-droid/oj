package com.qoj.module.agent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.setting.vo.AgentSettingsVO;
import com.qoj.security.SafeUrlValidator;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * OpenAiCompatibleAgentClient领域类型。封装 agent.service 模块内的相关职责。
 */
@Component
public class OpenAiCompatibleAgentClient implements AgentClient {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    /**
     * 构造 OpenAiCompatibleAgentClient 实例并保存其必要依赖或初始状态。从持久化层读取数据；可能调用外部判题或网关服务。
     */
    public OpenAiCompatibleAgentClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    /**
     * 封装chat相关逻辑。不满足业务约束时直接抛出明确异常；从持久化层读取数据；可能调用外部判题或网关服务。
     */
    @Override
    public String chat(AgentSettingsVO agent, String systemPrompt, String userPrompt) {
        try {
            String requestBody = objectMapper.writeValueAsString(new ChatRequest(
                agent.model,
                new Message[]{
                    /**
                     * 构造 消息 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                     */
                    new Message("system", systemPrompt),
                    new Message("user", userPrompt)
                }
            ));

            URI baseUri = SafeUrlValidator.requirePublicHttpUrl(agent.baseUrl, "AI 服务地址");
            HttpRequest request = HttpRequest.newBuilder()
                .uri(baseUri.resolve(normalizedBasePath(baseUri) + "chat/completions"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + agent.apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofMillis(agent.timeoutMs))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(502, "AI 服务返回错误：" + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode choices = root.get("choices");
            if (choices == null || choices.isEmpty()) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(502, "AI 服务返回空结果");
            }

            String content = choices.get(0).get("message").get("content").asText();
            if (content == null || content.isBlank()) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(502, "AI 服务返回空内容");
            }

            return content.trim();
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(502, "AI 服务请求失败：" + e.getMessage());
        }
    }

    /**
     * 解析并规范化dBasePath。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private String normalizedBasePath(URI baseUri) {
        String path = baseUri.getPath();
        if (path == null || path.isBlank() || "/".equals(path)) {
            return "/";
        }
        return path.replaceAll("/+$", "") + "/";
    }

    /**
     * Chat请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    private record ChatRequest(String model, Message[] messages) {}
    /**
     * 消息不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    private record Message(String role, String content) {}
}
