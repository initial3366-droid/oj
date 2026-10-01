package com.qoj.module.agent.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.agent.dto.AdminChatSessionRequest;
import com.qoj.module.agent.dto.AdminChatTitleRequest;
import com.qoj.module.agent.dto.AdminChatTitleGenerateRequest;
import com.qoj.module.agent.service.AdminChatHistoryService;
import com.qoj.module.agent.vo.AdminChatSessionVO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/agent/chat/sessions")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminChatHistoryController {
    private final AdminChatHistoryService history;

    public AdminChatHistoryController(AdminChatHistoryService history) {
        this.history = history;
    }

    @GetMapping
    public ApiResponse<List<AdminChatSessionVO>> list() {
        return ApiResponse.ok(history.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminChatSessionVO> detail(@PathVariable String id) {
        return ApiResponse.ok(history.detail(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminChatSessionVO> save(@PathVariable String id, @Valid @RequestBody AdminChatSessionRequest request) {
        return ApiResponse.ok(history.save(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        history.delete(id);
        return ApiResponse.ok();
    }

    @PutMapping("/{id}/title")
    public ApiResponse<AdminChatSessionVO> rename(@PathVariable String id, @Valid @RequestBody AdminChatTitleRequest request) {
        return ApiResponse.ok(history.rename(id, request.title()));
    }

    @PostMapping("/{id}/title/generate")
    public ApiResponse<AdminChatSessionVO> generateTitle(@PathVariable String id, @RequestBody(required = false) AdminChatTitleGenerateRequest request) {
        return ApiResponse.ok(history.generateTitle(id, request != null && Boolean.TRUE.equals(request.onlyIfPending())));
    }
}
