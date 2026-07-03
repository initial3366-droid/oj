package com.qoj.module.user.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("club_members")
public class ClubMember {
    public Long clubId;
    public Long userId;
    public String role;
    public LocalDateTime joinedAt;
}
