package com.qoj.module.xcpcio.vo;

/**
 * XcpcioPublic配置响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
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
