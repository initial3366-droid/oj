package com.qoj.module.home.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.home.dto.CarouselSlideRequest;
import com.qoj.module.home.service.HomeService;
import com.qoj.module.home.vo.CarouselSlideVO;
import com.qoj.module.home.vo.HomeConfigVO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理员首页接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/home")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminHomeController {
    private final HomeService homeService;

    /**
     * 构造 管理员首页Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminHomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    /**
     * 封装首页相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping
    public ApiResponse<HomeConfigVO> home() {
        return ApiResponse.ok(homeService.publicHome());
    }

    /**
     * 查询Slides列表。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/carousel")
    public ApiResponse<List<CarouselSlideVO>> listSlides() {
        return ApiResponse.ok(homeService.listSlidesForAdmin());
    }

    /**
     * 创建或提交Slide。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/carousel")
    public ApiResponse<CarouselSlideVO> createSlide(@Valid @RequestBody CarouselSlideRequest request) {
        return ApiResponse.ok(homeService.createSlide(request));
    }

    /**
     * 更新Slide。执行持久化写入。
     */
    @PutMapping("/carousel/{id}")
    public ApiResponse<CarouselSlideVO> updateSlide(
        @PathVariable long id,
        @Valid @RequestBody CarouselSlideRequest request
    ) {
        return ApiResponse.ok(homeService.updateSlide(id, request));
    }

    @DeleteMapping("/carousel/{id}")
    public ApiResponse<Void> deleteSlide(@PathVariable long id) {
        homeService.deleteSlide(id);
        return ApiResponse.ok();
    }
}
