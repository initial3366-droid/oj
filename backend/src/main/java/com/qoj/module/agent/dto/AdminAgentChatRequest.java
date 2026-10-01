package com.qoj.module.agent.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import com.qoj.module.agent.vo.AdminChatImageVO;
import com.qoj.module.agent.vo.AdminChatFileVO;

import java.util.List;

/** 管理后台 AI 对话请求。浏览器只提交用户与助手消息，系统提示由服务端维护。 */
public record AdminAgentChatRequest(
    @NotEmpty
    @Size(max = 40)
    List<@Valid Message> messages,
    @Size(max = 80) String sessionId,
    @Size(max = 80) String assistantMessageId,
    @Valid ApprovedImport approvedImport,
    @Size(max = 80) String continuationToken,
    Boolean resumeStopped
) {
    public AdminAgentChatRequest(List<Message> messages, String sessionId, String assistantMessageId) {
        this(messages, sessionId, assistantMessageId, null, null, false);
    }
    public AdminAgentChatRequest(List<Message> messages, String sessionId, String assistantMessageId, ApprovedImport approvedImport) {
        this(messages, sessionId, assistantMessageId, approvedImport, null, false);
    }
    public AdminAgentChatRequest(List<Message> messages, String sessionId, String assistantMessageId,
                                 ApprovedImport approvedImport, String continuationToken) {
        this(messages, sessionId, assistantMessageId, approvedImport, continuationToken, false);
    }
    public record ApprovedImport(@NotBlank @Size(max = 80) String planId,
        @NotNull @Valid com.qoj.module.agent.service.AdminChatImportService.CommitRequest request) {}
    public record Message(
        @NotBlank
        @Pattern(regexp = "user|assistant")
        String role,
        @NotNull
        @Size(max = 12000)
        String content,
        @Size(max = 4) List<@NotNull @Valid AdminChatImageVO> images,
        @Size(max = 4) List<@NotNull @Valid AdminChatFileVO> files
    ) {
        public Message(String role, String content) { this(role, content, null, null); }
    }
}
