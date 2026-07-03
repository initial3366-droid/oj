package com.qoj.module.agent.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.agent.dto.AgentChatRequest;
import com.qoj.module.agent.service.AgentChatService;
import com.qoj.module.agent.vo.AgentChatResponse;
import com.qoj.module.agent.vo.AgentQuotaVO;
import com.qoj.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/agent")
public class AgentController {
    private final AgentChatService agentChatService;

    public AgentController(AgentChatService agentChatService) {
        this.agentChatService = agentChatService;
    }

    @PostMapping("/chat")
    public ApiResponse<AgentChatResponse> chat(@Valid @RequestBody AgentChatRequest request) {
        return ApiResponse.ok(agentChatService.chat(request));
    }

    @GetMapping("/quota")
    public ApiResponse<AgentQuotaVO> quota() {
        long userId = CurrentUser.required().id();
        return ApiResponse.ok(agentChatService.getQuota(userId));
    }
}
