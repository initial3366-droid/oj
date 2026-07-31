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

/**
 * Agent接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/agent")
public class AgentController {
    private final AgentChatService agentChatService;

    /**
     * 构造 AgentController 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AgentController(AgentChatService agentChatService) {
        this.agentChatService = agentChatService;
    }

    /**
     * 封装chat相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/chat")
    public ApiResponse<AgentChatResponse> chat(@Valid @RequestBody AgentChatRequest request) {
        return ApiResponse.ok(agentChatService.chat(request));
    }

    /**
     * 封装quota相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    @GetMapping("/quota")
    public ApiResponse<AgentQuotaVO> quota() {
        long userId = CurrentUser.required().id();
        return ApiResponse.ok(agentChatService.getQuota(userId));
    }
}
