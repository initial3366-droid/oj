package com.qoj.module.user.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.user.dto.StudentBatchRequest;
import com.qoj.module.user.service.AdminStudentBatchService;
import com.qoj.module.user.service.AdminOperationPasswordService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/users/batch")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminStudentBatchController {
    private final AdminStudentBatchService service;
    private final AdminOperationPasswordService operationPassword;

    public AdminStudentBatchController(AdminStudentBatchService service, AdminOperationPasswordService operationPassword) {
        this.service = service;
        this.operationPassword = operationPassword;
    }

    @PostMapping
    public ApiResponse<AdminStudentBatchService.Result> execute(@Valid @RequestBody StudentBatchRequest request) {
        operationPassword.verify(request.adminPassword());
        return ApiResponse.ok(service.execute(request));
    }
}
