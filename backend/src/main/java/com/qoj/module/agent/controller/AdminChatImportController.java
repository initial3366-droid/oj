package com.qoj.module.agent.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.agent.service.AdminChatImportService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/agent/chat/imports")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminChatImportController {
    private final AdminChatImportService imports;
    public AdminChatImportController(AdminChatImportService imports) { this.imports = imports; }

    @PostMapping("/preview")
    public ApiResponse<AdminChatImportService.Plan> preview(@Valid @RequestBody AdminChatImportService.PreviewRequest request) { return ApiResponse.ok(imports.preview(request)); }

    @GetMapping("/{id}")
    public ApiResponse<AdminChatImportService.Plan> detail(@PathVariable String id) { return ApiResponse.ok(imports.detail(id)); }

    @PostMapping("/{id}/commit")
    public ApiResponse<AdminChatImportService.ImportResult> commit(@PathVariable String id, @Valid @RequestBody AdminChatImportService.CommitRequest request) { return ApiResponse.ok(imports.commit(id, request)); }
}
