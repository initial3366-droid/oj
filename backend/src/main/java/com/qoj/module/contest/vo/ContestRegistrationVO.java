package com.qoj.module.contest.vo;

import java.time.LocalDateTime;

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
