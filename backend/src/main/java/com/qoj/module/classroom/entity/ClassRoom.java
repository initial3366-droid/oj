package com.qoj.module.classroom.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 班级Room持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
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
