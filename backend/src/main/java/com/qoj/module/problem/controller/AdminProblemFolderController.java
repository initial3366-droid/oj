package com.qoj.module.problem.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.problem.dto.ProblemFolderRequest;
import com.qoj.module.problem.service.ProblemFolderService;
import com.qoj.module.problem.vo.ProblemFolderVO;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/v1/problem-folders")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminProblemFolderController {
    private final ProblemFolderService folderService;

    public AdminProblemFolderController(ProblemFolderService folderService) {
        this.folderService = folderService;
    }

    @GetMapping
    public ApiResponse<List<ProblemFolderVO>> list() {
        return ApiResponse.ok(folderService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<ProblemFolderVO> detail(@PathVariable long id) {
        return ApiResponse.ok(folderService.detail(id));
    }

    @PostMapping
    public ApiResponse<ProblemFolderVO> create(@Valid @RequestBody ProblemFolderRequest request) {
        return ApiResponse.ok(folderService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<ProblemFolderVO> update(@PathVariable long id, @Valid @RequestBody ProblemFolderRequest request) {
        return ApiResponse.ok(folderService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable long id) {
        folderService.delete(id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/problems")
    public ApiResponse<Void> moveProblems(@PathVariable long id, @RequestBody Map<String, List<Long>> body) {
        folderService.moveProblems(id, body.getOrDefault("problemIds", List.of()));
        return ApiResponse.ok();
    }
}
