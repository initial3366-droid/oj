package com.qoj.module.classroom.dto;

import jakarta.validation.constraints.Size;

/**
 * 班级RoomUpdate请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClassRoomUpdateRequest(
    @Size(max = 120) String name,
    @Size(max = 2000) String description,
    Long teacherId,
    Boolean joinEnabled,
    Boolean approvalRequired
) {
}
