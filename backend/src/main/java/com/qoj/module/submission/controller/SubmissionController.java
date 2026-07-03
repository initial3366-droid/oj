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

@RestController
@RequestMapping("/api/v1/submissions")
public class SubmissionController {
    private final SubmissionService submissionService;

    public SubmissionController(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

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
