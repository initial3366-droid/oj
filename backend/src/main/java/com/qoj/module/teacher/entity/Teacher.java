package com.qoj.module.teacher.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("teachers")
public class Teacher {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String username;
    public String teacherNo;
    public String email;
    public String passwordHash;
    public String displayName;
    public String avatarUrl;
    public Long majorId;
    public String status;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
