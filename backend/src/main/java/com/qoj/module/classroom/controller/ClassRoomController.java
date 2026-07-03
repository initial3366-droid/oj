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

@RestController
@RequestMapping("/api/v1/classes")
public class ClassRoomController {
    private final ClassRoomService classRoomService;

    public ClassRoomController(ClassRoomService classRoomService) {
        this.classRoomService = classRoomService;
    }

    @PostMapping("/{classId}/applications")
    public ApiResponse<ClassJoinApplicationVO> apply(
        @PathVariable long classId,
        @Valid @RequestBody(required = false) ClassJoinApplicationRequest request
    ) {
        return ApiResponse.ok(classRoomService.apply(classId, request));
    }
}
