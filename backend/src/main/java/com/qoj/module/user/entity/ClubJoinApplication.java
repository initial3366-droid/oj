package com.qoj.module.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("club_join_applications")
public class ClubJoinApplication {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long clubId;
    public Long userId;
    public String status;
    public String reason;
    public LocalDateTime createdAt;
    public LocalDateTime handledAt;
    public Long handledBy;
}
