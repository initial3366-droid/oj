package com.qoj.module.home.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.home.service.HomeService;
import com.qoj.module.home.vo.HomeConfigVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/home")
public class HomeController {
    private final HomeService homeService;

    public HomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    @GetMapping
    public ApiResponse<HomeConfigVO> home() {
        return ApiResponse.ok(homeService.publicHome());
    }
}
