package com.qoj.module.submission.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

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
