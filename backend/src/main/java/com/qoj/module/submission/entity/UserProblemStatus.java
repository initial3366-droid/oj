package com.qoj.module.submission.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 用户题目状态持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("user_problem_status")
public class UserProblemStatus {
    public Long userId;
    public Long problemId;
    public String bestStatus;
    public String lastStatus;
    public Long lastSubmissionId;
    public Integer submitCount;
    public LocalDateTime acceptedAt;
    public LocalDateTime lastSubmittedAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
