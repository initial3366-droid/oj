package com.qoj.module.problem.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("problem_folders")
public class ProblemFolder {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String name;
    public String description;
    public Integer displayOrder;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
