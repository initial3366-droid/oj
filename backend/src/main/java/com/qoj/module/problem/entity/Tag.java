package com.qoj.module.problem.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("tags")
public class Tag {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String name;
    public String color;
    public LocalDateTime createdAt;
}
