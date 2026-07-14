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

/**
 * 题目接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/problems")
public class ProblemController {
    private final ProblemService problemService;

    /**
     * 构造 题目Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public ProblemController(ProblemService problemService) {
        this.problemService = problemService;
    }

    /**
     * 查询目标数据列表。返回结果包含分页边界。
     */
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
