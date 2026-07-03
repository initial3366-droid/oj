package com.qoj.module.user.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("user_scores")
public class UserScore {
    @TableId
    public Long userId;
    public Integer totalScore;
    public Integer rating;
    public Integer acCount;
    public Integer submitCount;
    public Integer streak;
    public LocalDateTime updatedAt;
}
