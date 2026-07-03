package com.qoj.module.classroom.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("class_members")
public class ClassMember {
    public Long classId;
    public Long userId;
    public String source;
    public String importBatchId;
    public String profileFields;
    public LocalDateTime joinedAt;
}
