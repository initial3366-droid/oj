package com.qoj.module.announcement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AnnouncementCreateRequest {
    @NotBlank(message = "公告标题不能为空")
    @Size(max = 200, message = "公告标题不能超过200字符")
    public String title;

    @NotBlank(message = "公告内容不能为空")
    public String content;

    public Boolean isVisible = true;
}
