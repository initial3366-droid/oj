package com.qoj.module.teacher.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.auth.dto.AuthTokenResponse;
import com.qoj.module.auth.dto.LoginRequest;
import com.qoj.module.auth.service.AuthService;
import com.qoj.module.auth.service.CaptchaService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/teacher/v1/auth")
public class TeacherAuthController {
    private final AuthService authService;
    private final CaptchaService captchaService;

    public TeacherAuthController(AuthService authService, CaptchaService captchaService) {
        this.authService = authService;
        this.captchaService = captchaService;
    }

    @PostMapping("/login")
    public ApiResponse<AuthTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        captchaService.verifyCaptcha(request.captchaId(), request.captcha());
        return ApiResponse.ok(authService.loginTeacher(request));
    }
}
