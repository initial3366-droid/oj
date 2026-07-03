package com.qoj.module.classroom.vo;

import java.time.LocalDateTime;
import java.util.Map;

public record ClassRoomMemberVO(
    Long classId,
    String className,
    Long userId,
    String username,
    String displayName,
    String studentNo,
    String email,
    String source,
    Map<String, String> profileFields,
    LocalDateTime joinedAt
) {
}
