package com.qoj.module.classroom.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("class_join_applications")
public class ClassJoinApplication {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long classId;
    public Long userId;
    public String status;
    public String reason;
    public Long handledBy;
    public LocalDateTime handledAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
