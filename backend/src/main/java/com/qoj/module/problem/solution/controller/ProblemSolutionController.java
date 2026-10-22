package com.qoj.module.problem.solution.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.problem.solution.service.ProblemSolutionService;
import com.qoj.module.problem.solution.vo.ProblemSolutionLevelVO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/problems/{problemId}/solution")
public class ProblemSolutionController {
    private final ProblemSolutionService service;

    public ProblemSolutionController(ProblemSolutionService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<ProblemSolutionLevelVO> detail(
        @PathVariable long problemId,
        @RequestParam(required = false) Long practiceId
    ) {
        return ApiResponse.ok(service.publicDetail(problemId, practiceId));
    }

    public record AcceptRequest(@Min(1) int level) {}

    public record ViewRequest(@Min(1) int level) {}

    @PostMapping("/accept")
    public ApiResponse<ProblemSolutionLevelVO> accept(
        @PathVariable long problemId,
        @RequestParam(required = false) Long practiceId,
        @Valid @RequestBody AcceptRequest request
    ) {
        return ApiResponse.ok(service.acceptCurrentLevel(problemId, request.level(), practiceId));
    }

    @PostMapping("/next")
    public ApiResponse<ProblemSolutionLevelVO> next(
        @PathVariable long problemId,
        @RequestParam(required = false) Long practiceId
    ) {
        return ApiResponse.ok(service.nextLevel(problemId, practiceId));
    }

    @PostMapping("/view")
    public ApiResponse<ProblemSolutionLevelVO> view(
        @PathVariable long problemId,
        @RequestParam(required = false) Long practiceId,
        @Valid @RequestBody ViewRequest request
    ) {
        return ApiResponse.ok(service.viewLevel(problemId, request.level(), practiceId));
    }
}
