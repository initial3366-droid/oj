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

/**
 * 管理员Agent接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/agent")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminAgentController {
    private final AgentChatService agentChatService;

    /**
     * 构造 管理员AgentController 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminAgentController(AgentChatService agentChatService) {
        this.agentChatService = agentChatService;
    }

    /**
     * 读取Quota并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/quota/{userId}")
    public ApiResponse<AgentQuotaVO> getQuota(@PathVariable long userId) {
        return ApiResponse.ok(agentChatService.getQuota(userId));
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
