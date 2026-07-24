package com.qoj.module.auth.dto;

/**
 * 前台登录结果。普通用户返回令牌，教师账号只返回应进入的登录门户。
 */
public record FrontendLoginResponse(
    String portal,
    String accessToken,
    String refreshToken
) {
    public static FrontendLoginResponse user(AuthTokenResponse tokens) {
        return new FrontendLoginResponse("USER", tokens.accessToken(), tokens.refreshToken());
    }

    public static FrontendLoginResponse teacherPortal() {
        return new FrontendLoginResponse("TEACHER", null, null);
    }
}
