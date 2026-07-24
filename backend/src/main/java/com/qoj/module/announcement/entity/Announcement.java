package com.qoj.module.announcement.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 公告持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("announcements")
public class Announcement {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String title;
    public String content;
    public Long authorId;
    public String authorName;
    public Boolean isVisible;
    public Boolean isPinned;
    public Boolean isDeleted;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
