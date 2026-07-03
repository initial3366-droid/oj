package com.qoj.module.xcpcio.vo;

public record XcpcioPublicConfigVO(
    Long contestId,
    Boolean enabled,
    String mode,
    String boardUrl,
    Boolean embedAllowed,
    String status,
    String clicsScoreboardUrl
) {
}
