package com.qoj.module.classroom.vo;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 班级Room响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
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
