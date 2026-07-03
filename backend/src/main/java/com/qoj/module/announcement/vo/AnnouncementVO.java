package com.qoj.module.announcement.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

public class AnnouncementVO {
    public Long id;
    public String title;
    public String content;
    public Long authorId;
    public String authorName;
    public Boolean isVisible;
    public Integer viewCount;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    public LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    public LocalDateTime updatedAt;
}
