package com.qoj.module.admin.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.admin.service.AdminDashboardService;
import com.qoj.module.admin.vo.AdminDashboardVO;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理员仪表盘接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/dashboard")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminDashboardController {
    private final AdminDashboardService adminDashboardService;

    /**
     * 构造 管理员仪表盘Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminDashboardController(AdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    /**
     * 封装仪表盘相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping
    public ApiResponse<AdminDashboardVO> dashboard() {
        return ApiResponse.ok(adminDashboardService.dashboard());
    }
}
