package com.qoj.module.submission.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.submission.dto.SubmissionCreateRequest;
import com.qoj.module.submission.service.SubmissionService;
import com.qoj.module.submission.vo.SubmissionVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 提交接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/submissions")
public class SubmissionController {
    private final SubmissionService submissionService;

    /**
     * 构造 提交Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public SubmissionController(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    /**
     * 创建或提交目标数据。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping
    public ApiResponse<SubmissionVO> submit(
        @Valid @RequestBody SubmissionCreateRequest request,
        HttpServletRequest servletRequest
    ) {
        return ApiResponse.ok(submissionService.submit(request, servletRequest.getRemoteAddr()));
    }

    @GetMapping
    public ApiResponse<PageResult<SubmissionVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        @RequestParam(required = false) Long problemId,
        @RequestParam(required = false) Long contestId,
        @RequestParam(required = false) String language,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) Long userId
    ) {
        return ApiResponse.ok(submissionService.list(page, pageSize, problemId, contestId, language, status, userId));
    }

    @GetMapping("/{id}")
    public ApiResponse<SubmissionVO> detail(@PathVariable long id) {
        return ApiResponse.ok(submissionService.detail(id));
    }
}
