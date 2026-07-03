package com.qoj.module.submission.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.submission.dto.SandboxRunRequest;
import com.qoj.module.submission.service.SubmissionService;
import com.qoj.module.submission.vo.SandboxRunVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sandbox")
public class SandboxController {
    private final SubmissionService submissionService;

    public SandboxController(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    @PostMapping("/run")
    public ApiResponse<SandboxRunVO> run(@Valid @RequestBody SandboxRunRequest request) {
        return ApiResponse.ok(submissionService.sandboxRun(request));
    }
}
