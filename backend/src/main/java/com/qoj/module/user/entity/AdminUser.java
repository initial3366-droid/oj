package com.qoj.module.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 管理员用户持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
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
