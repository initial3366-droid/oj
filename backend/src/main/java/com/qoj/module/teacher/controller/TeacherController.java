package com.qoj.module.teacher.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.common.exception.BizException;
import com.qoj.module.admin.service.AdminDashboardService;
import com.qoj.module.admin.vo.AdminDashboardVO;
import com.qoj.module.auth.dto.UpdatePasswordRequest;
import com.qoj.module.auth.dto.UpdateProfileRequest;
import com.qoj.module.auth.service.AuthService;
import com.qoj.module.classroom.dto.ClassRoomCreateRequest;
import com.qoj.module.classroom.dto.ClassRoomUpdateRequest;
import com.qoj.module.classroom.dto.StudentImportRequest;
import com.qoj.module.classroom.dto.UpdateStudentRequest;
import com.qoj.module.classroom.service.ClassRoomService;
import com.qoj.module.classroom.service.StudentImportFileService;
import com.qoj.module.classroom.vo.ClassJoinApplicationVO;
import com.qoj.module.classroom.vo.ClassRoomMemberVO;
import com.qoj.module.classroom.vo.ClassRoomVO;
import com.qoj.module.classroom.vo.StudentImportResultVO;
import com.qoj.module.practice.service.PracticeService;
import com.qoj.module.practice.vo.PracticeReportVO;
import com.qoj.module.submission.service.SubmissionExportService;
import com.qoj.module.submission.service.SubmissionService;
import com.qoj.module.submission.vo.AdminSubmissionVO;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.service.UserAvatarService;
import com.qoj.module.user.vo.AvatarUploadVO;
import com.qoj.module.user.vo.UserVO;
import com.qoj.module.user.vo.UserMeVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

/**
 * 教师接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/teacher/v1")
@PreAuthorize("hasRole('TEACHER')")
public class TeacherController {
    private final AuthService authService;
    private final ClassRoomService classRoomService;
    private final SubmissionService submissionService;
    private final PracticeService practiceService;
    private final UserMapper userMapper;
    private final SubmissionExportService submissionExportService;
    private final StudentImportFileService studentImportFileService;
    private final AdminDashboardService adminDashboardService;
    private final UserAvatarService userAvatarService;

    /**
     * 构造 教师Controller 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public TeacherController(
        AuthService authService,
        ClassRoomService classRoomService,
        SubmissionService submissionService,
        PracticeService practiceService,
        UserMapper userMapper,
        SubmissionExportService submissionExportService,
        StudentImportFileService studentImportFileService,
        AdminDashboardService adminDashboardService,
        UserAvatarService userAvatarService
    ) {
        this.authService = authService;
        this.classRoomService = classRoomService;
        this.submissionService = submissionService;
        this.practiceService = practiceService;
        this.userMapper = userMapper;
        this.submissionExportService = submissionExportService;
        this.studentImportFileService = studentImportFileService;
        this.adminDashboardService = adminDashboardService;
        this.userAvatarService = userAvatarService;
    }

    @GetMapping("/me")
    public ApiResponse<UserMeVO> me() {
        return ApiResponse.ok(authService.me());
    }

    @GetMapping("/dashboard")
    public ApiResponse<AdminDashboardVO> dashboard() {
        return ApiResponse.ok(adminDashboardService.teacherDashboard());
    }

    /**
     * 教师更新个人信息（仅 displayName）。不要求邮箱验证码，区别于 AuthService.updateProfile。
     */
    @PutMapping("/me/profile")
    public ApiResponse<Void> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        AuthUser authUser = CurrentUser.required();
        User user = authUser.user();
        if (request.displayName() == null || request.displayName().trim().isEmpty()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "姓名不能为空");
        }
        user.displayName = request.displayName().trim();
        userMapper.updateById(user);
        return ApiResponse.ok();
    }

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AvatarUploadVO> updateMyAvatar(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(userAvatarService.updateUserAvatar(CurrentUser.required().user(), file));
    }

    /**
     * 教师修改密码（复用 AuthService.updatePassword，仅对前台 USER 账号生效）。
     */
    @PutMapping("/me/password")
    public ApiResponse<Void> updatePassword(@Valid @RequestBody UpdatePasswordRequest request) {
        authService.updatePassword(request);
        return ApiResponse.ok();
    }

    @GetMapping("/classes")
    public ApiResponse<List<ClassRoomVO>> classes() {
        return ApiResponse.ok(classRoomService.teacherClasses());
    }

    @GetMapping("/classes/{classId}")
    public ApiResponse<ClassRoomVO> classDetail(@PathVariable long classId) {
        return ApiResponse.ok(classRoomService.teacherClassDetail(classId));
    }

    @PostMapping("/classes")
    public ApiResponse<ClassRoomVO> createClass(@Valid @RequestBody ClassRoomCreateRequest request) {
        return ApiResponse.ok(classRoomService.teacherCreate(request));
    }

    @PutMapping("/classes/{classId}")
    public ApiResponse<ClassRoomVO> updateClass(
        @PathVariable long classId,
        @Valid @RequestBody ClassRoomUpdateRequest request
    ) {
        return ApiResponse.ok(classRoomService.teacherUpdate(classId, request));
    }

    @PostMapping("/classes/{classId}/delete")
    public ApiResponse<Void> deleteClass(@PathVariable long classId, @RequestBody Map<String, String> body) {
        String password = body.get("password");
        if (password == null || password.isBlank()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "请输入密码");
        }
        classRoomService.teacherDelete(classId, password);
        return ApiResponse.ok();
    }

    @GetMapping("/students")
    public ApiResponse<List<ClassRoomMemberVO>> students(@RequestParam(required = false) Long classId) {
        return ApiResponse.ok(classRoomService.teacherStudents(classId));
    }

    @GetMapping("/students/{userId}")
    public ApiResponse<UserVO> studentDetail(@PathVariable long userId) {
        return ApiResponse.ok(classRoomService.teacherStudentDetail(userId));
    }

    @PostMapping("/students/import")
    public ApiResponse<StudentImportResultVO> importStudents(@Valid @RequestBody StudentImportRequest request) {
        return ApiResponse.ok(classRoomService.importStudents(request));
    }

    @PostMapping(value = "/students/import-file", consumes = "multipart/form-data")
    public ApiResponse<StudentImportResultVO> importStudentFile(
        @RequestParam Long classId,
        @RequestParam(defaultValue = "学号") String studentNoField,
        @RequestParam(defaultValue = "姓名") String nameField,
        @RequestParam MultipartFile file
    ) {
        return ApiResponse.ok(classRoomService.importStudents(
            studentImportFileService.parse(classId, studentNoField, nameField, file)
        ));
    }

    @DeleteMapping("/classes/{classId}/students/{userId}")
    public ApiResponse<ClassRoomVO> removeStudent(@PathVariable long classId, @PathVariable long userId) {
        return ApiResponse.ok(classRoomService.removeMember(classId, userId));
    }

    @PutMapping("/students/{userId}")
    public ApiResponse<ClassRoomMemberVO> updateStudent(
        @PathVariable long userId,
        @Valid @RequestBody UpdateStudentRequest request
    ) {
        return ApiResponse.ok(classRoomService.teacherUpdateStudent(userId, request));
    }

    @PostMapping(value = "/students/{userId}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AvatarUploadVO> updateStudentAvatar(
        @PathVariable long userId,
        @RequestParam("file") MultipartFile file
    ) {
        User user = classRoomService.requireManagedStudent(userId);
        return ApiResponse.ok(userAvatarService.updateUserAvatar(user, file));
    }

    @GetMapping("/applications")
    public ApiResponse<List<ClassJoinApplicationVO>> applications(@RequestParam(required = false) Long classId) {
        return ApiResponse.ok(classRoomService.teacherApplications(classId));
    }

    @PostMapping("/applications/{applicationId}/approve")
    public ApiResponse<ClassJoinApplicationVO> approve(@PathVariable long applicationId) {
        return ApiResponse.ok(classRoomService.approve(applicationId));
    }

    @PostMapping("/applications/{applicationId}/reject")
    public ApiResponse<ClassJoinApplicationVO> reject(@PathVariable long applicationId) {
        return ApiResponse.ok(classRoomService.reject(applicationId));
    }

    @GetMapping("/submissions")
    public ApiResponse<PageResult<AdminSubmissionVO>> submissions(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        @RequestParam(required = false) Long id,
        @RequestParam(required = false) Long userId,
        @RequestParam(required = false) Long classId,
        @RequestParam(required = false) Long problemId,
        @RequestParam(required = false) Long contestId,
        @RequestParam(required = false) Long contestProblemId,
        @RequestParam(required = false) Long practiceId,
        @RequestParam(required = false) String language,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String judgeServer,
        @RequestParam(required = false) String identityType,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
        @RequestParam(required = false) String sortBy,
        @RequestParam(required = false) String sortOrder
    ) {
        return ApiResponse.ok(submissionService.adminList(
            page,
            pageSize,
            id,
            userId,
            classId,
            problemId,
            contestId,
            contestProblemId,
            practiceId,
            language,
            status,
            judgeServer,
            identityType,
            from,
            to,
            sortBy,
            sortOrder
        ));
    }

    @GetMapping("/submissions/{id}")
    public ApiResponse<AdminSubmissionVO> submissionDetail(@PathVariable long id) {
        return ApiResponse.ok(submissionService.adminDetail(id));
    }

    @GetMapping("/submissions/{id}/code")
    public ApiResponse<String> submissionCode(@PathVariable long id) {
        return ApiResponse.ok(submissionService.adminCode(id));
    }

    /**
     * 导出筛选后的提交记录为 CSV（UTF-8 BOM）。
     * 复用 /submissions 的过滤条件和教师可见性（applyVisibility 自动限制为教师所辖范围）。
     */
    @GetMapping("/submissions/export")
    public ResponseEntity<byte[]> exportSubmissionsCsv(
        @RequestParam(required = false) Long id,
        @RequestParam(required = false) Long userId,
        @RequestParam(required = false) Long classId,
        @RequestParam(required = false) Long problemId,
        @RequestParam(required = false) Long contestId,
        @RequestParam(required = false) Long contestProblemId,
        @RequestParam(required = false) Long practiceId,
        @RequestParam(required = false) String language,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String judgeServer,
        @RequestParam(required = false) String identityType,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
        @RequestParam(required = false) String sortBy,
        @RequestParam(required = false) String sortOrder
    ) {
        AuthUser authUser = CurrentUser.required();
        byte[] csv = submissionExportService.exportSubmissionsCsv(
            id, userId, classId, problemId, contestId, contestProblemId, practiceId,
            language, status, judgeServer, identityType, from, to, sortBy, sortOrder, authUser
        );
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + submissionExportService.buildFilename(authUser, from, to) + "\"")
            .contentType(MediaType.valueOf("text/csv;charset=UTF-8"))
            .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(csv.length))
            .body(csv);
    }

    @GetMapping("/practices/{id}/report")
    public ApiResponse<PracticeReportVO> practiceReport(@PathVariable long id) {
        return ApiResponse.ok(practiceService.report(id));
    }
}
