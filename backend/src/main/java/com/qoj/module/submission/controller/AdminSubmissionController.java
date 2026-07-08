package com.qoj.module.submission.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.submission.service.SubmissionExportService;
import com.qoj.module.submission.service.SubmissionService;
import com.qoj.module.submission.vo.AdminSubmissionVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.time.LocalDateTime;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端提交管理接口
 */
@RestController
@RequestMapping("/api/admin/v1/submissions")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminSubmissionController {
    private final SubmissionService submissionService;
    private final SubmissionExportService submissionExportService;

    public AdminSubmissionController(
        SubmissionService submissionService,
        SubmissionExportService submissionExportService
    ) {
        this.submissionService = submissionService;
        this.submissionExportService = submissionExportService;
    }

    @GetMapping
    public ApiResponse<PageResult<AdminSubmissionVO>> list(
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

    /**
     * 导出提交记录为 CSV（UTF-8 BOM，Excel/WPS 可直接打开）。
     * 复用 list 的过滤条件，导出全量（最多 EXPORT_LIMIT 条）。导出字段 = AdminSubmissionVO 主体列。
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv(
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

    @GetMapping("/{id}")
    public ApiResponse<AdminSubmissionVO> detail(@PathVariable Long id) {
        return ApiResponse.ok(submissionService.adminDetail(id));
    }

    /**
     * 查看提交代码（管理员权限）
     */
    @GetMapping("/{id}/code")
    public ApiResponse<String> getCode(@PathVariable Long id) {
        return ApiResponse.ok(submissionService.adminCode(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        submissionService.adminDelete(id);
        return ApiResponse.ok();
    }

    /**
     * 重判提交
     */
    @PostMapping("/{id}/rejudge")
    public ApiResponse<AdminSubmissionVO> rejudge(@PathVariable Long id) {
        return ApiResponse.ok(submissionService.adminRejudge(id));
    }
}
