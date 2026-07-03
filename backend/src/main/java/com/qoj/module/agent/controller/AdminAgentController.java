package com.qoj.module.agent.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.agent.service.AgentChatService;
import com.qoj.module.agent.vo.AgentQuotaVO;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/v1/agent")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminAgentController {
    private final AgentChatService agentChatService;

    public AdminAgentController(AgentChatService agentChatService) {
        this.agentChatService = agentChatService;
    }

    @GetMapping("/quota/{userId}")
    public ApiResponse<AgentQuotaVO> getQuota(@PathVariable long userId) {
        return ApiResponse.ok(agentChatService.getQuota(userId));
    }

    @PostMapping("/reset/user/{userId}")
    public ApiResponse<Void> resetUserQuota(@PathVariable long userId) {
        agentChatService.resetQuota(userId);
        return ApiResponse.ok();
    }

    @PostMapping("/reset/class/{classId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<Void> resetClassQuota(@PathVariable long classId) {
        agentChatService.resetQuotaForClass(classId);
        return ApiResponse.ok();
    }

    @PostMapping("/reset/all")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<Void> resetAllQuota() {
        agentChatService.resetQuotaForAll();
        return ApiResponse.ok();
    }
}
