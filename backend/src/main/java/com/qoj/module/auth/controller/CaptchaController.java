package com.qoj.module.auth.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.auth.dto.SendEmailCodeRequest;
import com.qoj.module.auth.service.CaptchaService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Captcha接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/captcha")
public class CaptchaController {
    private final CaptchaService captchaService;

    /**
     * 构造 CaptchaController 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public CaptchaController(CaptchaService captchaService) {
        this.captchaService = captchaService;
    }

    /**
     * 封装generateCaptcha相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/image")
    public ApiResponse<Map<String, String>> generateCaptcha() {
        return ApiResponse.ok(captchaService.generateImageCaptcha());
    }

    /**
     * 发送Email编码。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/email")
    public ApiResponse<Map<String, Object>> sendEmailCode(@Valid @RequestBody SendEmailCodeRequest request) {
        long remainingSeconds = captchaService.sendEmailVerificationCode(request.email(), request.captchaId(), request.captcha());
        return ApiResponse.ok(Map.of("remainingSeconds", remainingSeconds));
    }

    /**
     * 读取Email编码Remaining并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/email/remaining")
    public ApiResponse<Map<String, Object>> getEmailCodeRemaining(@RequestParam String email) {
        long remainingSeconds = captchaService.getEmailRateLimitRemaining(email);
        return ApiResponse.ok(Map.of("remainingSeconds", remainingSeconds));
    }
}
