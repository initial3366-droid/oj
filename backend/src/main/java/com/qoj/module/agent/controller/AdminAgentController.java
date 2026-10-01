package com.qoj.module.agent.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ApiResponse;
import com.qoj.module.agent.dto.AdminAgentChatRequest;
import com.qoj.module.agent.service.AgentChatService;
import com.qoj.module.agent.service.AdminChatHistoryService;
import com.qoj.module.agent.vo.AgentQuotaVO;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * 管理员Agent接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/agent")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminAgentController {
    private final AgentChatService agentChatService;
    private final ObjectMapper objectMapper;
    private final AdminChatHistoryService history;

    /**
     * 构造 管理员AgentController 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminAgentController(AgentChatService agentChatService, ObjectMapper objectMapper, AdminChatHistoryService history) {
        this.agentChatService = agentChatService;
        this.objectMapper = objectMapper;
        this.history = history;
    }

    /**
     * 读取Quota并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/quota/{userId}")
    public ApiResponse<AgentQuotaVO> getQuota(@PathVariable long userId) {
        return ApiResponse.ok(agentChatService.getQuota(userId));
    }

    @GetMapping("/quota/batch")
    public ApiResponse<Map<Long, AgentQuotaVO>> getQuotas(@RequestParam("userIds") List<Long> userIds) {
        if (userIds.size() > 100) {
            throw new com.qoj.common.exception.BizException(400, "一次最多查询 100 个用户的 AI 额度");
        }
        return ApiResponse.ok(agentChatService.getQuotas(userIds));
    }

    @PostMapping("/chat/tasks/{token}/stop")
    public ApiResponse<Void> stopChat(@PathVariable String token, @RequestBody Map<String, String> binding) {
        agentChatService.stopAdminChat(token, binding.get("sessionId"), binding.get("assistantMessageId"));
        return ApiResponse.ok(null);
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> streamChat(@Valid @RequestBody AdminAgentChatRequest request) {
        boolean persistent = request.sessionId() != null && request.assistantMessageId() != null;
        if ((request.sessionId() == null) != (request.assistantMessageId() == null)) {
            throw new com.qoj.common.exception.BizException(400, "聊天标识不完整");
        }
        long ownerId = persistent ? history.ownerId() : 0;
        if (persistent) history.requirePendingAssistant(request.sessionId(), request.assistantMessageId(), ownerId, request.continuationToken());
        AgentChatService.PreparedAdminChat preparedChat;
        try {
            preparedChat = agentChatService.prepareAdminChat(request);
        } catch (RuntimeException e) {
            if (persistent) history.saveAssistant(ownerId, request.sessionId(), request.assistantMessageId(),
                "回复失败：" + (e instanceof com.qoj.common.exception.BizException ? e.getMessage() : "AI 服务请求失败"), "error");
            throw e;
        }
        String priorReply = persistent && request.continuationToken() != null
            ? history.assistantContent(request.sessionId(), request.assistantMessageId(), ownerId) : "";
        StreamingResponseBody body = outputStream -> {
            StringBuilder reply = new StringBuilder(priorReply);
            String[] status = { "stopped" };
            String[] taskToken = { null };
            String[] taskLease = { null };
            long[] lastSaved = { System.currentTimeMillis() };
            try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8))) {
                writeEvent(writer, "start", Map.of("model", preparedChat.settings().model));
                try {
                    String continuation = agentChatService.streamAdminChat(preparedChat, content -> {
                        reply.append(content);
                        if (persistent && System.currentTimeMillis() - lastSaved[0] >= 1000) {
                            history.saveAssistant(ownerId, request.sessionId(), request.assistantMessageId(), reply.toString(), null);
                            lastSaved[0] = System.currentTimeMillis();
                        }
                        try {
                            writeEvent(writer, "delta", Map.of("content", content));
                        } catch (IOException e) {
                            throw new UncheckedIOException(e);
                        }
                    }, event -> {
                        try {
                            Map<String, Object> payload = new java.util.LinkedHashMap<>();
                            payload.put("phase", event.phase()); payload.put("name", event.name()); payload.put("callId", event.callId());
                            payload.put("success", event.success()); payload.put("cached", event.cached());
                            if (event.phase().equals("run")) {
                                taskToken[0] = event.data(); taskLease[0] = event.callId();
                                payload.put("continuationToken", event.data());
                                if (persistent) history.saveAssistantCheckpoint(ownerId, request.sessionId(), request.assistantMessageId(), event.data());
                            }
                            if (event.phase().equals("observation")) payload.put("result", objectMapper.readTree(event.data()));
                            else if (event.phase().equals("action")) payload.put("arguments", objectMapper.readTree(event.data()));
                            writeEvent(writer, "tool", payload);
                        } catch (IOException e) { throw new UncheckedIOException(e); }
                    });
                    if (continuation != null) {
                        status[0] = null;
                        if (persistent) history.saveAssistant(ownerId, request.sessionId(), request.assistantMessageId(), reply.toString(), null);
                        writeEvent(writer, "continue", Map.of("continuationToken", continuation));
                        return;
                    }
                    status[0] = "complete";
                    if (persistent) history.saveAssistant(ownerId, request.sessionId(), request.assistantMessageId(), reply.toString(), status[0]);
                    writeEvent(writer, "done", Map.of());
                } catch (com.qoj.module.agent.service.AgentRunStoppedException e) {
                    status[0] = "stopped";
                    writeEvent(writer, "stopped", Map.of("message", e.getMessage()));
                } catch (UncheckedIOException e) {
                    throw e.getCause();
                } catch (Exception e) {
                    status[0] = "error";
                    String message = e instanceof com.qoj.common.exception.BizException
                        ? e.getMessage()
                        : "AI 服务请求失败，请检查服务配置后重试";
                    if (reply.isEmpty()) reply.append("回复失败：").append(message);
                    writeEvent(writer, "error", Map.of("message", message));
                }
            } finally {
                try {
                    if (persistent && status[0] != null && !"complete".equals(status[0])) history.saveAssistant(ownerId, request.sessionId(), request.assistantMessageId(),
                        reply.isEmpty() && "stopped".equals(status[0]) ? "生成已停止。" : reply.toString(), status[0]);
                } finally { agentChatService.finishAdminChat(taskToken[0], taskLease[0]); }
            }
        };
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .header("Cache-Control", "no-cache, no-transform")
            .header("X-Accel-Buffering", "no")
            .body(body);
    }

    private void writeEvent(BufferedWriter writer, String event, Map<String, ?> data) throws IOException {
        writer.write("event: ");
        writer.write(event);
        writer.write("\ndata: ");
        writer.write(objectMapper.writeValueAsString(data));
        writer.write("\n\n");
        writer.flush();
    }

    /**
     * 重置用户Quota。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/reset/user/{userId}")
    public ApiResponse<Void> resetUserQuota(@PathVariable long userId) {
        agentChatService.resetQuota(userId);
        return ApiResponse.ok();
    }

    /**
     * 重置班级Quota。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/reset/class/{classId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<Void> resetClassQuota(@PathVariable long classId) {
        agentChatService.resetQuotaForClass(classId);
        return ApiResponse.ok();
    }

    /**
     * 重置AllQuota。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/reset/all")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<Void> resetAllQuota() {
        agentChatService.resetQuotaForAll();
        return ApiResponse.ok();
    }
}
