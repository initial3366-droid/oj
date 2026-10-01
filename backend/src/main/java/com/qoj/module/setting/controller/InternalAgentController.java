package com.qoj.module.setting.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.AgentSettingsVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/internal/agent")
public class InternalAgentController {
    private final SystemSettingService settingService;
    @Value("${agent.internal-token:${AGENT_INTERNAL_TOKEN:}}")
    private String internalToken;

    public InternalAgentController(SystemSettingService settingService) { this.settingService = settingService; }

    @GetMapping("/config")
    public ApiResponse<AgentSettingsVO> config(@RequestHeader(value = "X-Agent-Token", required = false) String token) {
        requireInternalToken(token);
        return ApiResponse.ok(settingService.getAgentRuntimeSettings());
    }

    @PostMapping("/authorize")
    public ApiResponse<Boolean> authorize(
        @RequestHeader(value = "X-Agent-Token", required = false) String token
    ) {
        requireInternalToken(token);
        AuthUser user = CurrentUser.get();
        if (user == null) throw new BizException(ErrorCode.UNAUTHORIZED, "管理员登录状态无效");
        return ApiResponse.ok(user.adminAccount() || user.teacherAccount());
    }

    private void requireInternalToken(String token) {
        if (internalToken.isBlank() || token == null || !internalToken.equals(token)) {
            throw new BizException(ErrorCode.FORBIDDEN, "agent token 无效");
        }
    }
}
