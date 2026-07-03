package com.qoj.module.announcement.dto;

import jakarta.validation.constraints.Size;

public class AnnouncementUpdateRequest {
    @Size(max = 200, message = "公告标题不能超过200字符")
    public String title;

    public String content;

    public Boolean isVisible;
}
