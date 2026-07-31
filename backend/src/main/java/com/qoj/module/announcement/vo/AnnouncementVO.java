package com.qoj.module.announcement.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

/**
 * 公告响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public class AnnouncementVO {
    public Long id;
    public String title;
    public String content;
    public Long authorId;
    public String authorName;
    public Boolean isVisible;
    public Boolean isPinned;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    public LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    public LocalDateTime updatedAt;
}
