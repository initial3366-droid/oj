package com.qoj.module.classroom.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.classroom.dto.ClassJoinApplicationRequest;
import com.qoj.module.classroom.service.ClassRoomService;
import com.qoj.module.classroom.vo.ClassJoinApplicationVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 班级Room接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/classes")
public class ClassRoomController {
    private final ClassRoomService classRoomService;

    /**
     * 构造 班级RoomController 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public ClassRoomController(ClassRoomService classRoomService) {
        this.classRoomService = classRoomService;
    }

    /**
     * 封装apply相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping("/{classId}/applications")
    public ApiResponse<ClassJoinApplicationVO> apply(
        @PathVariable long classId,
        @Valid @RequestBody(required = false) ClassJoinApplicationRequest request
    ) {
        return ApiResponse.ok(classRoomService.apply(classId, request));
    }
}
