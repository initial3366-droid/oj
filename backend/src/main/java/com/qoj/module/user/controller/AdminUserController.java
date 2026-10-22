package com.qoj.module.user.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.user.dto.UserCreateRequest;
import com.qoj.module.user.dto.AdminOperationPasswordRequest;
import com.qoj.module.user.service.AdminOperationPasswordService;
import com.qoj.module.user.dto.UserUpdateRequest;
import com.qoj.module.user.service.AdminStudentImportService;
import com.qoj.module.user.service.UserAdminService;
import com.qoj.module.user.service.UserAvatarService;
import com.qoj.module.user.vo.AdminStudentImportResultVO;
import com.qoj.module.user.vo.AvatarUploadVO;
import com.qoj.module.user.vo.AdminUserVO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 管理员用户接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/users")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminUserController {
    private final UserAdminService userAdminService;
    private final UserAvatarService userAvatarService;
    private final AdminStudentImportService adminStudentImportService;
    private final AdminOperationPasswordService operationPassword;

    /**
     * 构造 管理员用户Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminUserController(
        UserAdminService userAdminService,
        UserAvatarService userAvatarService,
        AdminStudentImportService adminStudentImportService,
        AdminOperationPasswordService operationPassword
    ) {
        this.userAdminService = userAdminService;
        this.userAvatarService = userAvatarService;
        this.adminStudentImportService = adminStudentImportService;
        this.operationPassword = operationPassword;
    }

    /**
     * 查询目标数据列表。返回结果包含分页边界。
     */
    @GetMapping
    public ApiResponse<PageResult<AdminUserVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        @RequestParam(required = false) String role,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) @Positive Long classId,
        @RequestParam(required = false) Boolean unassigned,
        @RequestParam(required = false) @Positive Long teacherId
    ) {
        return ApiResponse.ok(userAdminService.list(page, pageSize, role, keyword, classId, unassigned, teacherId));
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, HandlerMethodValidationException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> invalidFilter() {
        return ApiResponse.fail(400, "筛选参数错误：班级和教师编号必须为正整数");
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminUserVO> detail(@PathVariable long id) {
        return ApiResponse.ok(userAdminService.detail(id));
    }

    @PostMapping
    public ApiResponse<AdminUserVO> create(@Valid @RequestBody UserCreateRequest request) {
        return ApiResponse.ok(userAdminService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminUserVO> update(
        @PathVariable long id,
        @Valid @RequestBody UserUpdateRequest request
    ) {
        return ApiResponse.ok(userAdminService.update(id, request));
    }

    @PostMapping(value = "/{id}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AvatarUploadVO> updateAvatar(
        @PathVariable long id,
        @RequestParam("file") MultipartFile file
    ) {
        return ApiResponse.ok(userAvatarService.updateUserAvatar(id, file));
    }

    @PostMapping(value = "/import-xlsx", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AdminStudentImportResultVO> importStudents(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(adminStudentImportService.importXlsx(file));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable long id, @Valid @RequestBody(required = false) AdminOperationPasswordRequest request) {
        operationPassword.verify(request == null ? null : request.adminPassword());
        userAdminService.delete(id);
        return ApiResponse.ok();
    }
}
