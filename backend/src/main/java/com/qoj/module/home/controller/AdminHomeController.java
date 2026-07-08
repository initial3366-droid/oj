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

@RestController
@RequestMapping("/api/admin/v1/home")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminHomeController {
    private final HomeService homeService;

    public AdminHomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    @GetMapping
    public ApiResponse<HomeConfigVO> home() {
        return ApiResponse.ok(homeService.publicHome());
    }

    @GetMapping("/carousel")
    public ApiResponse<List<CarouselSlideVO>> listSlides() {
        return ApiResponse.ok(homeService.listSlidesForAdmin());
    }

    @PostMapping("/carousel")
    public ApiResponse<CarouselSlideVO> createSlide(@Valid @RequestBody CarouselSlideRequest request) {
        return ApiResponse.ok(homeService.createSlide(request));
    }

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
