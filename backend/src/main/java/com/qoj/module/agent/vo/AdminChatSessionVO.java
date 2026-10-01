package com.qoj.module.agent.vo;

import com.qoj.module.agent.dto.AdminChatSessionRequest.Message;
import java.util.List;

public record AdminChatSessionVO(
    String id, String title, long createdAt, long updatedAt, long version, List<Message> messages,
    String titleSource, long titleRevision
) {}
