package com.qoj.module.xcpcio.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.xcpcio.service.XcpcioConfigService;
import com.qoj.module.xcpcio.vo.XcpcioPublicConfigVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/contests/{contestId}/xcpcio")
public class XcpcioPublicController {
    private final XcpcioConfigService configService;

    public XcpcioPublicController(XcpcioConfigService configService) {
        this.configService = configService;
    }

    @GetMapping("/public-config")
    public ApiResponse<XcpcioPublicConfigVO> publicConfig(@PathVariable Long contestId) {
        return ApiResponse.ok(configService.getPublicConfig(contestId));
    }
}
