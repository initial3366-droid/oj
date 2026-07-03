package com.qoj.module.admin.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.admin.service.AdminDashboardService;
import com.qoj.module.admin.vo.AdminDashboardVO;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/v1/dashboard")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','CLUB_ADMIN')")
public class AdminDashboardController {
    private final AdminDashboardService adminDashboardService;

    public AdminDashboardController(AdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    @GetMapping
    public ApiResponse<AdminDashboardVO> dashboard() {
        return ApiResponse.ok(adminDashboardService.dashboard());
    }
}
