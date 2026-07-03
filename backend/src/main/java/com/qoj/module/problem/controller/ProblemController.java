package com.qoj.module.problem.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.problem.service.ProblemService;
import com.qoj.module.problem.vo.PublicProblemVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/problems")
public class ProblemController {
    private final ProblemService problemService;

    public ProblemController(ProblemService problemService) {
        this.problemService = problemService;
    }

    @GetMapping
    public ApiResponse<PageResult<PublicProblemVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Integer difficulty,
        @RequestParam(required = false) String tag
    ) {
        return ApiResponse.ok(problemService.list(page, pageSize, keyword, difficulty, tag));
    }

    @GetMapping("/{id}")
    public ApiResponse<PublicProblemVO> detail(@PathVariable long id) {
        return ApiResponse.ok(problemService.publicDetail(id));
    }
}
