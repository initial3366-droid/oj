package com.qoj.module.practice.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("practice_publications")
public class PracticePublication {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long sourcePracticeId;
    public Long courseId;
    public Integer displayOrder;
    public String publisherAccountType;
    public Long publisherId;
    public String title;
    public String description;
    public String status;
    public String studentAccessMode;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    public String passwordHash;
    public LocalDateTime startTime;
    public LocalDateTime endTime;
    public LocalDateTime publishedAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
