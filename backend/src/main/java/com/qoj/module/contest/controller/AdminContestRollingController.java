package com.qoj.module.contest.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.contest.service.ContestRollingService;
import com.qoj.module.contest.vo.ContestRollingStateVO;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理员比赛Rolling接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/contests")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminContestRollingController {
    private final ContestRollingService rollingService;

    /**
     * 构造 管理员比赛RollingController 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminContestRollingController(ContestRollingService rollingService) {
        this.rollingService = rollingService;
    }

    /**
     * 读取State并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/{contestId}/rolling")
    public ApiResponse<ContestRollingStateVO> getState(@PathVariable Long contestId) {
        return ApiResponse.ok(rollingService.getState(contestId));
    }

    /**
     * 封装start相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/{contestId}/rolling/start")
    public ApiResponse<ContestRollingStateVO> start(@PathVariable Long contestId) {
        return ApiResponse.ok(rollingService.start(contestId));
    }

    /**
     * 封装step相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/{contestId}/rolling/step")
    public ApiResponse<ContestRollingStateVO> step(
        @PathVariable Long contestId,
        @RequestParam(defaultValue = "next") String direction
    ) {
        return ApiResponse.ok(rollingService.step(contestId, direction));
    }

    @PostMapping("/{contestId}/rolling/finish")
    public ApiResponse<ContestRollingStateVO> finish(@PathVariable Long contestId) {
        return ApiResponse.ok(rollingService.finish(contestId));
    }

    @PostMapping("/{contestId}/rolling/publish-final")
    public ApiResponse<ContestRollingStateVO> publishFinal(@PathVariable Long contestId) {
        return ApiResponse.ok(rollingService.publishFinal(contestId));
    }
}
