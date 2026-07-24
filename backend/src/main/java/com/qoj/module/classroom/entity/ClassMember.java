package com.qoj.module.classroom.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 班级Member持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("class_members")
public class ClassMember {
    public Long classId;
    public Long userId;
    public String source;
    public String importBatchId;
    public String profileFields;
    public LocalDateTime joinedAt;
}
