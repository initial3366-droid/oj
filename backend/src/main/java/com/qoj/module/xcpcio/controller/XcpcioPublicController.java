package com.qoj.module.xcpcio.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.xcpcio.service.XcpcioConfigService;
import com.qoj.module.xcpcio.vo.XcpcioPublicConfigVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * XcpcioPublic接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/contests/{contestId}/xcpcio")
public class XcpcioPublicController {
    private final XcpcioConfigService configService;

    /**
     * 构造 XcpcioPublicController 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public XcpcioPublicController(XcpcioConfigService configService) {
        this.configService = configService;
    }

    /**
     * 封装public配置相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/public-config")
    public ApiResponse<XcpcioPublicConfigVO> publicConfig(@PathVariable Long contestId) {
        return ApiResponse.ok(configService.getPublicConfig(contestId));
    }
}
