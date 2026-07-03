package com.qoj.module.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("clubs")
public class Club {
    @TableId(type = IdType.INPUT)
    public Long id;
    public String name;
    public String description;
    public Long ownerId;
    public Boolean joinEnabled;
    public String inviteCode;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
