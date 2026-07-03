package com.qoj.module.auth.dto;

public record AuthTokenResponse(
    String accessToken,
    String refreshToken
) {
}
