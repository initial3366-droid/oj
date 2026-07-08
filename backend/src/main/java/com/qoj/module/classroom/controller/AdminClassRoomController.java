package com.qoj.module.classroom.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.classroom.dto.ClassRoomCreateRequest;
import com.qoj.module.classroom.dto.ClassRoomUpdateRequest;
import com.qoj.module.classroom.dto.TeacherCreateRequest;
import com.qoj.module.classroom.dto.TeacherUpdateRequest;
import com.qoj.module.classroom.service.ClassRoomService;
import com.qoj.module.classroom.service.StudentImportFileService;
import com.qoj.module.classroom.vo.ClassRoomVO;
import com.qoj.module.classroom.vo.StudentImportResultVO;
import com.qoj.module.classroom.vo.TeacherVO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/v1")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminClassRoomController {
    private final ClassRoomService classRoomService;
    private final StudentImportFileService studentImportFileService;

    public AdminClassRoomController(ClassRoomService classRoomService, StudentImportFileService studentImportFileService) {
        this.classRoomService = classRoomService;
        this.studentImportFileService = studentImportFileService;
    }

    @GetMapping("/classes")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
    public ApiResponse<List<ClassRoomVO>> classes(@RequestParam(required = false) String keyword) {
        return ApiResponse.ok(classRoomService.adminList(keyword));
    }

    @GetMapping("/classes/{classId}")
    public ApiResponse<ClassRoomVO> classDetail(@PathVariable long classId) {
        return ApiResponse.ok(classRoomService.adminDetail(classId));
    }

    @PostMapping("/classes")
    public ApiResponse<ClassRoomVO> createClass(@Valid @RequestBody ClassRoomCreateRequest request) {
        return ApiResponse.ok(classRoomService.adminCreate(request));
    }

    @PutMapping("/classes/{classId}")
    public ApiResponse<ClassRoomVO> updateClass(
        @PathVariable long classId,
        @Valid @RequestBody ClassRoomUpdateRequest request
    ) {
        return ApiResponse.ok(classRoomService.adminUpdate(classId, request));
    }

    @DeleteMapping("/classes/{classId}")
    public ApiResponse<Void> deleteClass(@PathVariable long classId) {
        classRoomService.adminDelete(classId);
        return ApiResponse.ok();
    }

    @PostMapping(value = "/students/import", consumes = "multipart/form-data")
    public ApiResponse<StudentImportResultVO> importStudents(
        @RequestParam Long classId,
        @RequestParam(defaultValue = "学号") String studentNoField,
        @RequestParam(defaultValue = "姓名") String nameField,
        @RequestParam MultipartFile file
    ) {
        return ApiResponse.ok(classRoomService.importStudents(
            studentImportFileService.parse(classId, studentNoField, nameField, file)
        ));
    }

    @GetMapping("/teachers")
    public ApiResponse<List<TeacherVO>> teachers(@RequestParam(required = false) String keyword) {
        return ApiResponse.ok(classRoomService.listTeachers(keyword));
    }

    @PostMapping("/teachers")
    public ApiResponse<TeacherVO> createTeacher(@Valid @RequestBody TeacherCreateRequest request) {
        return ApiResponse.ok(classRoomService.createTeacher(request));
    }

    @PutMapping("/teachers/{teacherId}")
    public ApiResponse<TeacherVO> updateTeacher(
        @PathVariable long teacherId,
        @Valid @RequestBody TeacherUpdateRequest request
    ) {
        return ApiResponse.ok(classRoomService.updateTeacher(teacherId, request));
    }

    @DeleteMapping("/teachers/{teacherId}")
    public ApiResponse<Void> deleteTeacher(@PathVariable long teacherId) {
        classRoomService.deleteTeacher(teacherId);
        return ApiResponse.ok();
    }
}
