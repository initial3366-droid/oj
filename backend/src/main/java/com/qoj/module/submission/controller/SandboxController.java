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

/**
 * 沙箱接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/sandbox")
public class SandboxController {
    private final SubmissionService submissionService;

    /**
     * 构造 沙箱Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public SandboxController(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    /**
     * 封装run相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/run")
    public ApiResponse<SandboxRunVO> run(@Valid @RequestBody SandboxRunRequest request) {
        return ApiResponse.ok(submissionService.sandboxRun(request));
    }
}
