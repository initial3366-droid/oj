package com.qojagent.service;

import com.qojagent.config.AgentSettings;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;

@Component
public class AgentModelFactory {
    private volatile CachedModel cachedModel;

    public OpenAiChatModel get(AgentSettings settings) {
        if (settings == null || settings.baseUrl() == null || settings.baseUrl().isBlank() ||
            settings.apiKey() == null || settings.apiKey().isBlank() ||
            settings.model() == null || settings.model().isBlank()) {
            throw new AgentException(503, "AI 服务配置不完整");
        }
        URI base = validatePublicUrl(settings.baseUrl());
        String baseUrl = base.toString().replaceAll("/+$", "");
        long timeout = settings.timeoutMs() == null || settings.timeoutMs() <= 0 ? 30000L : settings.timeoutMs();
        String keyHash = hash(settings.apiKey());
        CachedModel current = cachedModel;
        if (current != null && current.matches(baseUrl, keyHash, settings.model(), timeout)) return current.model();
        synchronized (this) {
            current = cachedModel;
            if (current != null && current.matches(baseUrl, keyHash, settings.model(), timeout)) return current.model();
            OpenAiChatOptions options = OpenAiChatOptions.builder()
                .baseUrl(baseUrl)
                .apiKey(settings.apiKey())
                .model(settings.model())
                .timeout(Duration.ofMillis(timeout))
                .maxRetries(0)
                .build();
            OpenAiChatModel model = OpenAiChatModel.builder().options(options).build();
            cachedModel = new CachedModel(baseUrl, keyHash, settings.model(), timeout, model);
            return model;
        }
    }

    public URI validatePublicUrl(String value) {
        try {
            URI uri = URI.create(value.trim());
            if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) ||
                uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) {
                throw new IllegalArgumentException();
            }
            String host = uri.getHost().toLowerCase();
            if (host.equals("localhost") || host.endsWith(".localhost")) throw new IllegalArgumentException();
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() ||
                    address.isSiteLocalAddress() || address.isMulticastAddress()) throw new IllegalArgumentException();
            }
            return uri;
        } catch (Exception e) {
            throw new AgentException(400, "AI 服务地址必须是有效的公网 http/https 地址");
        }
    }

    private String hash(String key) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private record CachedModel(String baseUrl, String keyHash, String modelName, long timeout, OpenAiChatModel model) {
        private boolean matches(String url, String key, String model, long configuredTimeout) {
            return baseUrl.equals(url) && keyHash.equals(key) && modelName.equals(model) && timeout == configuredTimeout;
        }
    }
}
