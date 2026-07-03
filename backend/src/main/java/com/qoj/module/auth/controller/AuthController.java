package com.qoj.module.auth.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.auth.dto.AuthTokenResponse;
import com.qoj.module.auth.dto.BindEmailRequest;
import com.qoj.module.auth.dto.LoginRequest;
import com.qoj.module.auth.dto.RefreshTokenRequest;
import com.qoj.module.auth.dto.RegisterRequest;
import com.qoj.module.auth.dto.UpdatePasswordRequest;
import com.qoj.module.auth.dto.UpdateProfileRequest;
import com.qoj.module.auth.service.AuthService;
import com.qoj.module.auth.service.CaptchaService;
import com.qoj.module.user.vo.UserMeVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService authService;
    private final CaptchaService captchaService;

    public AuthController(AuthService authService, CaptchaService captchaService) {
        this.authService = authService;
        this.captchaService = captchaService;
    }

    @PostMapping("/login")
    public ApiResponse<AuthTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        // 教师端登录会携带验证码字段，前台用户登录不传
        if (request.captchaId() != null || request.captcha() != null) {
            captchaService.verifyCaptcha(request.captchaId(), request.captcha());
        }
        return ApiResponse.ok(authService.loginUser(request));
    }

    @PostMapping("/register")
    public ApiResponse<AuthTokenResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok(authService.register(request));
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthTokenResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ApiResponse.ok(authService.refresh(request));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest request) {
        authService.logout(request.getHeader("Authorization"));
        return ApiResponse.ok();
    }

    @GetMapping("/me")
    public ApiResponse<UserMeVO> me() {
        return ApiResponse.ok(authService.me());
    }

    @PutMapping("/profile")
    public ApiResponse<Void> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        authService.updateProfile(request);
        return ApiResponse.ok();
    }

    @PutMapping("/email")
    public ApiResponse<Void> bindEmail(@Valid @RequestBody BindEmailRequest request) {
        authService.bindEmail(request);
        return ApiResponse.ok();
    }

    @PutMapping("/password")
    public ApiResponse<Void> updatePassword(@Valid @RequestBody UpdatePasswordRequest request) {
        authService.updatePassword(request);
        return ApiResponse.ok();
    }
}
