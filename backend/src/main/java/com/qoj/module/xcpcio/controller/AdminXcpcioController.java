package com.qoj.module.xcpcio.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.xcpcio.dto.XcpcioConfigRequest;
import com.qoj.module.xcpcio.service.XcpcioConfigService;
import com.qoj.module.xcpcio.service.XcpcioSyncService;
import com.qoj.module.xcpcio.vo.XcpcioConfigVO;
import com.qoj.module.xcpcio.vo.XcpcioSyncLogVO;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/v1/contests/{contestId}/xcpcio")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','CLUB_ADMIN')")
public class AdminXcpcioController {
    private final XcpcioConfigService configService;
    private final XcpcioSyncService syncService;

    public AdminXcpcioController(XcpcioConfigService configService, XcpcioSyncService syncService) {
        this.configService = configService;
        this.syncService = syncService;
    }

    @GetMapping("/config")
    public ApiResponse<XcpcioConfigVO> getConfig(@PathVariable Long contestId) {
        return ApiResponse.ok(configService.getAdminConfig(contestId));
    }

    @PutMapping("/config")
    public ApiResponse<XcpcioConfigVO> updateConfig(
        @PathVariable Long contestId,
        @RequestBody XcpcioConfigRequest request
    ) {
        return ApiResponse.ok(configService.updateConfig(contestId, request));
    }

    @PostMapping("/sync")
    public ApiResponse<XcpcioConfigVO> sync(@PathVariable Long contestId) {
        return ApiResponse.ok(syncService.syncContest(contestId, "MANUAL", true));
    }

    @GetMapping("/status")
    public ApiResponse<XcpcioConfigVO> status(@PathVariable Long contestId) {
        return ApiResponse.ok(configService.getAdminConfig(contestId));
    }

    @GetMapping("/logs")
    public ApiResponse<List<XcpcioSyncLogVO>> logs(@PathVariable Long contestId) {
        return ApiResponse.ok(configService.listLogs(contestId));
    }
}
