package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("contest_participants")
public class ContestParticipant {
    @TableId(type = IdType.AUTO)
    public Long id;

    public Long contestId;
    public Long userId;
    public Long teamId;

    public String participantType; // INDIVIDUAL, TEAM
    public String nickname;

    public Long organizationId;
    public String identityType; // PERSONAL, CLUB
    public Long identityId;
    public Boolean starred;

    public String status; // NORMAL, BANNED, UNOFFICIAL

    public LocalDateTime registeredAt;
    public LocalDateTime createdAt;
}
