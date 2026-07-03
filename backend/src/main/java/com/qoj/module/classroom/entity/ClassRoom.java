package com.qoj.module.classroom.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("classes")
public class ClassRoom {
    @TableId(type = IdType.INPUT)
    public Long id;
    public String name;
    public String description;
    public Long teacherId;
    public Boolean joinEnabled;
    public Boolean approvalRequired;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
