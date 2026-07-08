package com.qoj.module.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("users")
public class User {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String username;
    public String studentNo;
    public String email;
    public String passwordHash;
    public String role;
    public Long classId;
    public String displayName;
    public String avatarUrl;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
