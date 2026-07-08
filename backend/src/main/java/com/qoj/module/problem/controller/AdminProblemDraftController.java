package com.qoj.module.problem.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.problem.dto.ProblemDraftBasicRequest;
import com.qoj.module.problem.dto.ProblemDraftTestCasesRequest;
import com.qoj.module.problem.dto.ProblemDraftVO;
import com.qoj.module.problem.service.ProblemDraftService;
import com.qoj.module.problem.vo.ProblemVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/v1/problem-drafts")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminProblemDraftController {
    private final ProblemDraftService problemDraftService;

    public AdminProblemDraftController(ProblemDraftService problemDraftService) {
        this.problemDraftService = problemDraftService;
    }

    @PostMapping
    public ApiResponse<ProblemDraftVO> create() {
        return ApiResponse.ok(problemDraftService.createDraft());
    }

    @GetMapping("/{draftId}")
    public ApiResponse<ProblemDraftVO> detail(@PathVariable String draftId) {
        return ApiResponse.ok(problemDraftService.detail(draftId));
    }

    @PutMapping("/{draftId}/basic")
    public ApiResponse<ProblemDraftVO> saveBasic(
        @PathVariable String draftId,
        @Valid @RequestBody ProblemDraftBasicRequest request
    ) {
        return ApiResponse.ok(problemDraftService.saveBasic(draftId, request));
    }

    @PutMapping("/{draftId}/test-cases")
    public ApiResponse<ProblemDraftVO> saveTestCases(
        @PathVariable String draftId,
        @Valid @RequestBody ProblemDraftTestCasesRequest request
    ) {
        return ApiResponse.ok(problemDraftService.saveTestCases(draftId, request));
    }

    @PostMapping("/{draftId}/test-cases/zip")
    public ApiResponse<ProblemDraftVO> importZip(
        @PathVariable String draftId,
        @RequestPart("file") MultipartFile file,
        @RequestParam(defaultValue = "false") boolean overwrite
    ) {
        return ApiResponse.ok(problemDraftService.importZip(draftId, file, overwrite));
    }

    @PostMapping("/{draftId}/commit")
    public ApiResponse<ProblemVO> commit(@PathVariable String draftId) {
        return ApiResponse.ok(problemDraftService.commit(draftId));
    }
}
