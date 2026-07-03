package com.qoj.module.classroom.vo;

import java.time.LocalDateTime;
import java.util.List;

public record ClassRoomVO(
    Long id,
    String name,
    String description,
    Long teacherId,
    String teacherName,
    Boolean joinEnabled,
    Boolean approvalRequired,
    Integer memberCount,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    List<ClassRoomMemberVO> members
) {
}
