package com.qoj.module.practice.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.practice.dto.PracticeUnlockRequest;
import com.qoj.module.practice.service.PracticeService;
import com.qoj.module.practice.vo.PracticeVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 练习接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/practices")
public class PracticeController {
    private final PracticeService practiceService;

    /**
     * 构造 练习Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public PracticeController(PracticeService practiceService) {
        this.practiceService = practiceService;
    }

    /**
     * 查询目标数据列表。返回结果包含分页边界。
     */
    @GetMapping
    public ApiResponse<PageResult<PracticeVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int pageSize,
        @RequestParam(defaultValue = "all") String scope
    ) {
        return ApiResponse.ok(practiceService.list(page, pageSize, scope));
    }

    @GetMapping("/{id}")
    public ApiResponse<PracticeVO> detail(@PathVariable long id) {
        return ApiResponse.ok(practiceService.detail(id, null));
    }

    @PostMapping("/{id}/unlock")
    public ApiResponse<PracticeVO> unlock(
        @PathVariable long id,
        @Valid @RequestBody PracticeUnlockRequest request
    ) {
        return ApiResponse.ok(practiceService.detail(id, request.password()));
    }
}
