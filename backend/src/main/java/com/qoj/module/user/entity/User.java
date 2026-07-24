package com.qoj.module.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 用户持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
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
