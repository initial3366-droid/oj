package com.qoj.module.user.vo;

/**
 * 用户当前用户响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record UserMeVO(
    Long id,
    String username,
    String displayName,
    String avatarUrl,
    String studentNo,
    String email,
    String role,
    Integer totalSolved,
    Integer totalSubmissions,
    Long classId,
    String className
) {
}
