package com.qoj.module.classroom.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 班级Join持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("class_join_applications")
public class ClassJoinApplication {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long classId;
    public Long userId;
    public String status;
    public String reason;
    public Long handledBy;
    public String handledByAccountType;
    public LocalDateTime handledAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
