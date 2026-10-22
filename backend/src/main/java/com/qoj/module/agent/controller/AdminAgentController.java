package com.qoj.module.agent.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ApiResponse;
import com.qoj.common.exception.BizException;
import com.qoj.module.agent.dto.AdminAgentChatRequest;
import com.qoj.module.agent.service.AgentApprovalRequiredException;
import com.qoj.module.agent.service.AgentChatService;
import com.qoj.module.agent.service.AgentRunState;
import com.qoj.module.agent.service.AgentRunStoppedException;
import com.qoj.security.CurrentUser;
import com.qoj.module.agent.vo.AgentQuotaVO;
import com.qoj.module.user.dto.AdminOperationPasswordRequest;
import com.qoj.module.user.service.AdminOperationPasswordService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * 管理员Agent接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/agent")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminAgentController {
    private final AgentChatService agentChatService;
    private final AdminOperationPasswordService operationPassword;
    private final ObjectMapper objectMapper;
    private final TaskScheduler heartbeatScheduler;

    /**
     * 构造 管理员AgentController 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminAgentController(AgentChatService agentChatService, ObjectMapper objectMapper, AdminOperationPasswordService operationPassword,
        @Qualifier("agentChatHeartbeatScheduler") TaskScheduler heartbeatScheduler) {
        this.agentChatService = agentChatService;
        this.operationPassword = operationPassword;
        this.objectMapper = objectMapper;
        this.heartbeatScheduler = heartbeatScheduler;
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
            throw new BizException(400, "一次最多查询 100 个用户的 AI 额度");
        }
        return ApiResponse.ok(agentChatService.getQuotas(userIds));
    }

    public record StopRequest(@NotBlank @Size(max = 80) String sessionId,
                              @NotBlank @Size(max = 80) String assistantMessageId,
                              @Size(max = 200000) String content) {}

    @PostMapping("/chat/stop")
    public ApiResponse<Void> stopChat(@Valid @RequestBody StopRequest request) {
        long owner = CurrentUser.required().id();
        agentChatService.requestAdminChatStop(owner, request.sessionId(), request.assistantMessageId());
        agentChatService.awaitAdminChatStopped(owner, request.sessionId(), request.assistantMessageId());
        return ApiResponse.ok();
    }

    @PostMapping("/chat/tasks/{token}/stop")
    public ApiResponse<Void> stopChat(@PathVariable String token, @RequestBody Map<String, String> binding) {
        agentChatService.stopAdminChat(token, binding.get("sessionId"), binding.get("assistantMessageId"));
        return ApiResponse.ok(null);
    }

    public record ApprovalRequest(
        String sessionId,
        String assistantMessageId,
        @NotBlank String callId,
        @NotBlank String choice,
        @Size(max = 1000) String customText) {}

    @GetMapping("/chat/tasks/{token}/approval")
    public ApiResponse<AgentRunState.Approval> pendingApproval(
        @PathVariable String token, @RequestParam String sessionId, @RequestParam String assistantMessageId) {
        return ApiResponse.ok(agentChatService.pendingAdminApproval(token, sessionId, assistantMessageId));
    }

    @PostMapping("/chat/tasks/{token}/approval")
    public ApiResponse<Void> answerApproval(@PathVariable String token, @Valid @RequestBody ApprovalRequest request) {
        agentChatService.answerAdminApproval(token, request.sessionId(), request.assistantMessageId(),
            request.callId(), request.choice(), request.customText());
        return ApiResponse.ok();
    }

    @GetMapping("/chat/context")
    public ApiResponse<Map<String, Object>> context() {
        return ApiResponse.ok(agentChatService.adminContextInfo());
    }

    @PostMapping("/chat/context/compact")
    public ApiResponse<Map<String, String>> compact(@Valid @RequestBody AdminAgentChatRequest request) {
        return ApiResponse.ok(Map.of("summary", agentChatService.compactAdminContext(request)));
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> streamChat(@Valid @RequestBody AdminAgentChatRequest request,
                                                           HttpServletResponse response) {
        if ((request.sessionId() == null) != (request.assistantMessageId() == null)) {
            throw new BizException(400, "聊天标识不完整");
        }
        AgentChatService.PreparedAdminChat preparedChat = agentChatService.prepareAdminChat(request);
        StreamingResponseBody body = outputStream -> {
            String[] taskToken = { null };
            String[] taskLease = { null };
            try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8));
                 AgentChatEventStream stream = new AgentChatEventStream(writer, objectMapper, heartbeatScheduler, response)) {
                stream.event("start", Map.of("model", preparedChat.settings().model));
                try {
                    String continuation = agentChatService.streamAdminChat(preparedChat, content -> {
                        try {
                            stream.event("delta", Map.of("content", content));
                        } catch (IOException e) {
                            throw new UncheckedIOException(e);
                        }
                    }, event -> {
                        try {
                            Map<String, Object> payload = new LinkedHashMap<>();
                            payload.put("phase", event.phase()); payload.put("name", event.name()); payload.put("callId", event.callId());
                            payload.put("success", event.success()); payload.put("cached", event.cached());
                            if (event.phase().equals("run")) {
                                taskToken[0] = event.data(); taskLease[0] = event.callId();
                                payload.put("continuationToken", event.data());

                            }
                            if (event.phase().equals("observation")) payload.put("result", objectMapper.readTree(event.data()));
                            else if (event.phase().equals("action")) payload.put("arguments", objectMapper.readTree(event.data()));
                            if (event.phase().equals("context")) stream.event("context", objectMapper.readValue(event.data(), Map.class));
                            else stream.event("tool", payload);
                        } catch (IOException e) { throw new UncheckedIOException(e); }
                    }, stream::disconnected);
                    if (continuation != null) {
                        stream.event("continue", Map.of("continuationToken", continuation));
                        return;
                    }
                    stream.event("done", Map.of());
                } catch (AgentApprovalRequiredException e) {
                    stream.event("approval_required", Map.of("continuationToken", taskToken[0],
                        "callId", e.approval().callId(), "name", e.approval().name(),
                        "description", e.approval().description()));
                } catch (AgentRunStoppedException e) {
                    stream.event("stopped", Map.of("message", e.getMessage()));
                } catch (UncheckedIOException e) {
                    throw e.getCause();
                } catch (Exception e) {
                    String message = e instanceof BizException
                        ? e.getMessage()
                        : "AI 服务请求失败，请检查服务配置后重试";
                    stream.event("error", Map.of("message", message, "code",
                        e instanceof BizException business ? business.getCode() : 500));
                }
            } finally {
                agentChatService.finishAdminChat(taskToken[0], taskLease[0]);
            }
        };
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .header("Cache-Control", "no-cache, no-transform")
            .header("X-Accel-Buffering", "no")
            .body(body);
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
    public ApiResponse<Void> resetAllQuota(@Valid @RequestBody(required = false) AdminOperationPasswordRequest request) {
        operationPassword.verify(request == null ? null : request.adminPassword());
        agentChatService.resetQuotaForAll();
        return ApiResponse.ok();
    }
}
