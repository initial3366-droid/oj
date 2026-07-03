package com.qoj.module.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("admin_users")
public class AdminUser {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String username;
    public String email;
    public String passwordHash;
    public String role;
    public String displayName;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
