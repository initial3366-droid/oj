package com.qoj.module.classroom.vo;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 班级RoomMember响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ClassRoomMemberVO(
    Long classId,
    String className,
    Long userId,
    String username,
    String displayName,
    String avatarUrl,
    String studentNo,
    String email,
    String source,
    Map<String, String> profileFields,
    LocalDateTime joinedAt
) {
}
