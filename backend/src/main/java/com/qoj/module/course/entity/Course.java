package com.qoj.module.course.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("courses")
public class Course {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String title;
    public String description;
    public String term;
    public String ownerAccountType;
    public Long ownerId;
    public Long classId;
    public String status;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
