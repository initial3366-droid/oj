package com.qoj.module.practice.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("practices")
public class Practice {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String title;
    public String description;
    public Long ownerId;
    public String audience;
    public Long audienceId;
    public String passwordHash;
    public Boolean published;
    public Boolean isDeleted;
    public LocalDateTime deletedAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
