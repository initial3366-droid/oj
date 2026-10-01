package com.qoj.module.agent.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("admin_ai_chat_sessions")
public class AdminChatSession {
    @TableId(type = IdType.INPUT)
    public String id;
    public Long ownerAdminId;
    public String title;
    public String titleSource;
    public Long titleRevision;
    public String messages;
    public Long createdAt;
    public Long updatedAt;
    public Long version;
}
