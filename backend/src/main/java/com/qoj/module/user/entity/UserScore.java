package com.qoj.module.user.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 用户分数持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
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
