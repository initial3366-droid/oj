package com.qoj.module.problem.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 题目文件夹持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("problem_folders")
public class ProblemFolder {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String name;
    public String description;
    public Integer displayOrder;
    public Long ownerId;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
