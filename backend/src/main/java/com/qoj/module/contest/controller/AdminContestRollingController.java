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

@RestController
@RequestMapping("/api/admin/v1/contests")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminContestRollingController {
    private final ContestRollingService rollingService;

    public AdminContestRollingController(ContestRollingService rollingService) {
        this.rollingService = rollingService;
    }

    @GetMapping("/{contestId}/rolling")
    public ApiResponse<ContestRollingStateVO> getState(@PathVariable Long contestId) {
        return ApiResponse.ok(rollingService.getState(contestId));
    }

    @PostMapping("/{contestId}/rolling/start")
    public ApiResponse<ContestRollingStateVO> start(@PathVariable Long contestId) {
        return ApiResponse.ok(rollingService.start(contestId));
    }

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
