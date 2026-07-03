package com.qoj.module.xcpcio.dto;

public record XcpcioConfigRequest(
    Boolean enabled,
    String mode,
    String xcpcioContestId,
    String token,
    String boardUrl,
    String clicsAccessToken,
    Boolean syncEnabled,
    Integer syncIntervalSeconds
) {
}
