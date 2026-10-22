package com.qoj.module.problem.solution.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.problem.solution.dto.GenerateProblemSolutionRequest;
import com.qoj.module.problem.solution.dto.SaveProblemSolutionsRequest;
import com.qoj.module.problem.solution.service.ProblemSolutionService;
import com.qoj.module.problem.solution.vo.AdminProblemSolutionsVO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/problems/{problemId}/solutions")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminProblemSolutionController {
    private final ProblemSolutionService service;

    public AdminProblemSolutionController(ProblemSolutionService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<AdminProblemSolutionsVO> detail(@PathVariable long problemId) {
        return ApiResponse.ok(service.adminDetail(problemId));
    }

    @PutMapping
    public ApiResponse<AdminProblemSolutionsVO> save(
        @PathVariable long problemId,
        @Valid @RequestBody SaveProblemSolutionsRequest request
    ) {
        return ApiResponse.ok(service.save(problemId, request));
    }

    @PostMapping("/generate")
    public ApiResponse<List<String>> generate(
        @PathVariable long problemId,
        @Valid @RequestBody GenerateProblemSolutionRequest request
    ) {
        return ApiResponse.ok(service.generate(problemId, request));
    }
}
