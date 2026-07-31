package com.qoj.module.contest.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.contest.dto.ContestRegisterRequest;
import com.qoj.module.contest.service.ContestService;
import com.qoj.module.contest.vo.ContestRegistrationOptionVO;
import com.qoj.module.problem.vo.ProblemVO;
import com.qoj.module.contest.vo.ContestScoreboardVO;
import com.qoj.module.contest.vo.ContestVO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 比赛接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/contests")
public class ContestController {
    private final ContestService contestService;

    /**
     * 构造 比赛Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public ContestController(ContestService contestService) {
        this.contestService = contestService;
    }

    /**
     * 查询目标数据列表。返回结果包含分页边界。
     */
    @GetMapping
    public ApiResponse<PageResult<ContestVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.ok(contestService.list(page, pageSize));
    }

    @GetMapping("/{id}")
    public ApiResponse<ContestVO> detail(@PathVariable long id) {
        return ApiResponse.ok(contestService.detail(id));
    }

    @PostMapping("/{id}/register")
    public ApiResponse<Void> register(@PathVariable long id, @Valid @RequestBody ContestRegisterRequest request) {
        contestService.register(id, request);
        return ApiResponse.ok();
    }

    @GetMapping("/{id}/registration-options")
    public ApiResponse<List<ContestRegistrationOptionVO>> registrationOptions(@PathVariable long id) {
        return ApiResponse.ok(contestService.registrationOptions(id));
    }

    @GetMapping("/{id}/problems/{contestProblemId}")
    public ApiResponse<ProblemVO> problemDetail(
        @PathVariable long id,
        @PathVariable long contestProblemId
    ) {
        return ApiResponse.ok(contestService.problemDetail(id, contestProblemId));
    }

    @GetMapping("/{id}/scoreboard")
    public ApiResponse<ContestScoreboardVO> scoreboard(@PathVariable long id) {
        return ApiResponse.ok(contestService.scoreboard(id));
    }
}
