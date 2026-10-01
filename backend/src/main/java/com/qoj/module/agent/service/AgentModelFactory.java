package com.qoj.module.agent.service;

import com.qoj.common.exception.BizException;
import com.qoj.module.setting.vo.AgentSettingsVO;
import com.qoj.security.SafeUrlValidator;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;

/** Creates and reuses a Spring AI model for the currently configured OpenAI-compatible provider. */
@Component
public class AgentModelFactory {
    public static final long STREAM_TIMEOUT_MS = 120000L;
    private volatile CachedModel cachedModel;
    private volatile CachedModel cachedStreamingModel;

    public OpenAiChatModel get(AgentSettingsVO settings) {
        return get(settings, false);
    }

    public OpenAiChatModel getStreaming(AgentSettingsVO settings) {
        return get(settings, true);
    }

    private OpenAiChatModel get(AgentSettingsVO settings, boolean streaming) {
        if (settings == null || settings.baseUrl == null || settings.apiKey == null || settings.model == null) {
            throw new BizException(503, "AI 服务配置不完整");
        }
        URI baseUri = SafeUrlValidator.requirePublicHttpUrl(settings.baseUrl, "AI 服务地址");
        String baseUrl = baseUri.toString().replaceAll("/+$", "");
        // SDK request timeout covers the whole HTTP call, including an actively producing stream.
        long timeoutMs = streaming ? STREAM_TIMEOUT_MS
            : settings.timeoutMs == null || settings.timeoutMs <= 0 ? 30000L : settings.timeoutMs;
        String apiKeyHash = sha256(settings.apiKey);

        CachedModel current = streaming ? cachedStreamingModel : cachedModel;
        if (current != null && current.matches(baseUrl, apiKeyHash, settings.model, timeoutMs)) {
            return current.model();
        }
        synchronized (this) {
            current = streaming ? cachedStreamingModel : cachedModel;
            if (current != null && current.matches(baseUrl, apiKeyHash, settings.model, timeoutMs)) {
                return current.model();
            }
            OpenAiChatOptions options = OpenAiChatOptions.builder()
                .baseUrl(baseUrl)
                .apiKey(settings.apiKey)
                .model(settings.model)
                .timeout(Duration.ofMillis(timeoutMs))
                .maxRetries(0)
                .build();
            OpenAiChatModel model = OpenAiChatModel.builder().options(options).build();
            CachedModel cached = new CachedModel(baseUrl, apiKeyHash, settings.model, timeoutMs, model);
            if (streaming) cachedStreamingModel = cached;
            else cachedModel = cached;
            return model;
        }
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private record CachedModel(String baseUrl, String apiKeyHash, String modelName, long timeoutMs, OpenAiChatModel model) {
        private boolean matches(String url, String keyHash, String configuredModel, long timeout) {
            return baseUrl.equals(url) && apiKeyHash.equals(keyHash)
                && modelName.equals(configuredModel) && timeoutMs == timeout;
        }
    }
}
