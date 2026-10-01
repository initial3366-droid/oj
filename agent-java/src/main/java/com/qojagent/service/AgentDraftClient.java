package com.qojagent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

/** Keeps draft creation in the QOJ backend; the isolated Agent forwards the same authenticated API calls. */
@Component
public class AgentDraftClient {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${qoj.base-url:}")
    private String qojBaseUrl;

    public AgentDraftClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public JsonNode saveDraft(String authorization, String basic, MultipartFile file) {
        if (authorization == null || !authorization.startsWith("Bearer ") || authorization.length() < 10) {
            throw new AgentException(401, "QOJ 管理员登录状态无效");
        }
        final JsonNode basicValue;
        try {
            basicValue = objectMapper.readTree(basic);
        } catch (IOException e) {
            throw new AgentException(400, "题目 basic JSON 无效");
        }

        JsonNode created = call("POST", "/api/admin/v1/problem-drafts", authorization, null);
        String draftId = created.path("draftId").asText("");
        if (draftId.isBlank()) throw new AgentException(502, "QOJ 后端未返回草稿编号");
        call("PUT", "/api/admin/v1/problem-drafts/" + draftId + "/basic", authorization, basicValue);
        uploadZip(draftId, authorization, file);
        return call("POST", "/api/admin/v1/problem-drafts/" + draftId + "/commit", authorization, null);
    }

    private JsonNode call(String method, String path, String authorization, JsonNode body) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(apiUri(path))
                .header("Accept", MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", authorization)
                .timeout(Duration.ofSeconds(90));
            if (body == null) builder.method(method, HttpRequest.BodyPublishers.noBody());
            else builder.header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .method(method, HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            return responseData(response);
        } catch (AgentException e) {
            throw e;
        } catch (Exception e) {
            throw new AgentException(502, "调用 QOJ 草稿接口失败");
        }
    }

    private void uploadZip(String draftId, String authorization, MultipartFile file) {
        String boundary = "qoj-agent-" + UUID.randomUUID();
        try {
            ByteArrayOutputStream body = new ByteArrayOutputStream();
            byte[] delimiter = ("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8);
            body.write(delimiter);
            body.write(("Content-Disposition: form-data; name=\"file\"; filename=\"data.zip\"\r\n" +
                "Content-Type: application/zip\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.write(file.getBytes());
            body.write("\r\n".getBytes(StandardCharsets.UTF_8));
            body.write(delimiter);
            body.write("Content-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n".getBytes(StandardCharsets.UTF_8));
            body.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

            HttpRequest request = HttpRequest.newBuilder(apiUri("/api/admin/v1/problem-drafts/" + draftId + "/test-cases/zip"))
                .header("Authorization", authorization)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .timeout(Duration.ofSeconds(120))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            responseData(response);
        } catch (AgentException e) {
            throw e;
        } catch (Exception e) {
            throw new AgentException(502, "上传题目测试数据失败");
        }
    }

    private JsonNode responseData(HttpResponse<String> response) throws IOException {
        JsonNode envelope = objectMapper.readTree(response.body());
        if (response.statusCode() < 200 || response.statusCode() >= 300 || envelope.path("code").asInt() != 200) {
            String message = envelope.path("message").asText("QOJ 后端请求失败");
            throw new AgentException(response.statusCode() == 401 ? 401 : 502, message);
        }
        return envelope.path("data");
    }

    private URI apiUri(String path) {
        if (qojBaseUrl == null || qojBaseUrl.isBlank()) throw new AgentException(503, "QOJ 后端地址未配置");
        return URI.create(qojBaseUrl.replaceAll("/+$", "") + path);
    }
}
