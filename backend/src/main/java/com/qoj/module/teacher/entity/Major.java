package com.qoj.module.teacher.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("majors")
public class Major {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String code;
    public String name;
    public String status;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
