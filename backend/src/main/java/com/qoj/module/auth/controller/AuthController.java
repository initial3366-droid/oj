package com.qoj.module.auth.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.auth.dto.AuthTokenResponse;
import com.qoj.module.auth.dto.BindEmailRequest;
import com.qoj.module.auth.dto.LoginRequest;
import com.qoj.module.auth.dto.LogoutRequest;
import com.qoj.module.auth.dto.RefreshTokenRequest;
import com.qoj.module.auth.dto.RegisterRequest;
import com.qoj.module.auth.dto.ResetPasswordRequest;
import com.qoj.module.auth.dto.UpdatePasswordRequest;
import com.qoj.module.auth.dto.UpdateProfileRequest;
import com.qoj.module.auth.service.AuthService;
import com.qoj.module.auth.service.CaptchaService;
import com.qoj.module.user.service.UserAvatarService;
import com.qoj.module.user.vo.AvatarUploadVO;
import com.qoj.module.user.vo.UserMeVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 认证接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService authService;
    private final CaptchaService captchaService;
    private final UserAvatarService userAvatarService;

    /**
     * 构造 认证Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AuthController(AuthService authService, CaptchaService captchaService, UserAvatarService userAvatarService) {
        this.authService = authService;
        this.captchaService = captchaService;
        this.userAvatarService = userAvatarService;
    }

    /**
     * 封装登录相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/login")
    public ApiResponse<AuthTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        // 教师端登录会携带验证码字段，前台用户登录不传
        if (request.captchaId() != null || request.captcha() != null) {
            captchaService.verifyCaptcha(request.captchaId(), request.captcha());
        }
        return ApiResponse.ok(authService.loginUser(request));
    }

    /**
     * 创建或提交目标数据。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/register")
    public ApiResponse<AuthTokenResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok(authService.register(request));
    }

    /**
     * 重置Password。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ApiResponse.ok();
    }

    /**
     * 封装refresh相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/refresh")
    public ApiResponse<AuthTokenResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ApiResponse.ok(authService.refresh(request));
    }

    /**
     * 封装退出登录相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(
        HttpServletRequest request,
        @RequestBody(required = false) LogoutRequest logoutRequest
    ) {
        authService.logout(
            request.getHeader("Authorization"),
            logoutRequest == null ? null : logoutRequest.refreshToken()
        );
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

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AvatarUploadVO> updateAvatar(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(userAvatarService.updateUserAvatar(com.qoj.security.CurrentUser.required().user(), file));
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
