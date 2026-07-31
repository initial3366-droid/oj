package com.qoj.module.xcpcio.dto;

/**
 * Xcpcio配置请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
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
