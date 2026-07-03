package com.qoj.module.practice.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.practice.service.PracticeService;
import com.qoj.module.practice.vo.PracticeVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/practices")
public class PracticeController {
    private final PracticeService practiceService;

    public PracticeController(PracticeService practiceService) {
        this.practiceService = practiceService;
    }

    @GetMapping
    public ApiResponse<PageResult<PracticeVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int pageSize,
        @RequestParam(defaultValue = "all") String scope
    ) {
        return ApiResponse.ok(practiceService.list(page, pageSize, scope));
    }

    @GetMapping("/{id}")
    public ApiResponse<PracticeVO> detail(
        @PathVariable long id,
        @RequestParam(required = false) String password
    ) {
        return ApiResponse.ok(practiceService.detail(id, password));
    }
}
