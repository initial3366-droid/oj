package com.qoj.module.announcement.dto;

import jakarta.validation.constraints.Size;

/**
 * 公告Update请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public class AnnouncementUpdateRequest {
    @Size(max = 200, message = "公告标题不能超过200字符")
    public String title;

    public String content;

    public Boolean isVisible;

    public Boolean isPinned;
}
