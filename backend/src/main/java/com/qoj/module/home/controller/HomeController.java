package com.qoj.module.home.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.home.service.HomeService;
import com.qoj.module.home.vo.HomeConfigVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 首页接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/home")
public class HomeController {
    private final HomeService homeService;

    /**
     * 构造 首页Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public HomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    /**
     * 封装首页相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping
    public ApiResponse<HomeConfigVO> home() {
        return ApiResponse.ok(homeService.publicHome());
    }
}
