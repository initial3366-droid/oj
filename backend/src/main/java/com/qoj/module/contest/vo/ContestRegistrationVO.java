package com.qoj.module.contest.vo;

import java.time.LocalDateTime;

/**
 * 比赛报名响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public class ContestRegistrationVO {
    public Long id;
    public Long contestId;
    public Long userId;
    public String username;
    public String displayName;
    public String identityType;
    public Long identityId;
    public Boolean starred;
    public String status;
    public LocalDateTime registeredAt;
}
