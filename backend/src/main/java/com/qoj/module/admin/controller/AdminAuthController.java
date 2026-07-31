package com.qoj.module.admin.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.auth.dto.AuthTokenResponse;
import com.qoj.module.auth.dto.LoginRequest;
import com.qoj.module.auth.dto.UpdateProfileRequest;
import com.qoj.module.auth.service.AuthService;
import com.qoj.module.auth.service.CaptchaService;
import com.qoj.module.user.vo.UserMeVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理员认证接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1")
public class AdminAuthController {
    private final AuthService authService;
    private final CaptchaService captchaService;

    /**
     * 构造 管理员认证Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminAuthController(AuthService authService, CaptchaService captchaService) {
        this.authService = authService;
        this.captchaService = captchaService;
    }

    /**
     * 封装登录相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/auth/login")
    public ApiResponse<AuthTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        captchaService.verifyCaptcha(request.captchaId(), request.captcha());
        return ApiResponse.ok(authService.loginAdmin(request));
    }

    /**
     * 封装当前用户相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/me")
    public ApiResponse<UserMeVO> me() {
        return ApiResponse.ok(authService.adminMe());
    }

    /**
     * 更新资料。执行持久化写入。
     */
    @PutMapping("/me")
    public ApiResponse<Void> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        authService.updateProfile(request);
        return ApiResponse.ok();
    }
}
