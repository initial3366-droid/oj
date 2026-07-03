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

@RestController
@RequestMapping("/api/v1/captcha")
public class CaptchaController {
    private final CaptchaService captchaService;

    public CaptchaController(CaptchaService captchaService) {
        this.captchaService = captchaService;
    }

    @GetMapping("/image")
    public ApiResponse<Map<String, String>> generateCaptcha() {
        return ApiResponse.ok(captchaService.generateImageCaptcha());
    }

    @PostMapping("/email")
    public ApiResponse<Map<String, Object>> sendEmailCode(@Valid @RequestBody SendEmailCodeRequest request) {
        long remainingSeconds = captchaService.sendEmailVerificationCode(request.email(), request.captchaId(), request.captcha());
        return ApiResponse.ok(Map.of("remainingSeconds", remainingSeconds));
    }

    @GetMapping("/email/remaining")
    public ApiResponse<Map<String, Object>> getEmailCodeRemaining(@RequestParam String email) {
        long remainingSeconds = captchaService.getEmailRateLimitRemaining(email);
        return ApiResponse.ok(Map.of("remainingSeconds", remainingSeconds));
    }
}
