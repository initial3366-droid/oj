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
    private static final String RUN_HEADER = "X-Qoj-Internal-Stream-Id";
    private final java.util.concurrent.ConcurrentMap<String, StreamCall> streamCalls = new java.util.concurrent.ConcurrentHashMap<>();
    private volatile CachedModel cachedModel;
    private volatile CachedModel cachedStreamingModel;

    public OpenAiChatModel get(AgentSettingsVO settings) {
        return get(settings, false);
    }

    public OpenAiChatModel getStreaming(AgentSettingsVO settings) {
        return get(settings, true);
    }

    /** Also cancels the transport before the provider has sent response headers. */
    public reactor.core.publisher.Flux<org.springframework.ai.chat.model.ChatResponse> stream(
            AgentSettingsVO settings, org.springframework.ai.chat.prompt.Prompt prompt) {
        return reactor.core.publisher.Flux.defer(() -> {
            String id = java.util.UUID.randomUUID().toString();
            var call = new StreamCall();
            streamCalls.put(id, call);
            var options = prompt.getOptions() instanceof OpenAiChatOptions configured
                ? configured.mutate() : OpenAiChatOptions.builder();
            var headers = new java.util.HashMap<String, String>();
            if (prompt.getOptions() instanceof OpenAiChatOptions configured && configured.getCustomHeaders() != null) {
                headers.putAll(configured.getCustomHeaders());
            }
            headers.put(RUN_HEADER, id);
            return reactor.core.publisher.Flux.defer(() -> getStreaming(settings).stream(
                    new org.springframework.ai.chat.prompt.Prompt(prompt.getInstructions(), options.customHeaders(headers).build())))
                .doFinally(signal -> { call.cancel(); streamCalls.remove(id, call); });
        });
    }

    public org.springframework.ai.openai.http.okhttp.OpenAiHttpClientBuilderCustomizer cancellationCustomizer() {
        return builder -> builder.interceptor(chain -> {
            String id = chain.request().header(RUN_HEADER);
            if (id == null) return chain.proceed(chain.request());
            var registered = streamCalls.get(id);
            if (registered == null || !registered.attach(chain.call())) {
                chain.call().cancel();
                throw new java.io.InterruptedIOException("AI stream cancelled");
            }
            return chain.proceed(chain.request().newBuilder().removeHeader(RUN_HEADER).build());
        });
    }

    private static final class StreamCall {
        private okhttp3.Call call;
        private boolean cancelled;
        synchronized boolean attach(okhttp3.Call value) {
            if (cancelled) return false;
            call = value;
            return true;
        }
        synchronized void cancel() {
            cancelled = true;
            if (call != null) call.cancel();
        }
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
            OpenAiChatModel model = OpenAiChatModel.builder().options(options).httpClientBuilderCustomizer(cancellationCustomizer()).build();
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
