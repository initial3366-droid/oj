package com.qoj.module.contest.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.contest.service.ContestService;
import com.qoj.module.contest.vo.PublicScoreboardVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 比赛Public接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/contests/public")
public class ContestPublicController {
    private final ContestService contestService;

    /**
     * 构造 比赛PublicController 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public ContestPublicController(ContestService contestService) {
        this.contestService = contestService;
    }

    /**
     * 获取比赛公开榜单数据（JSON格式，无需登录）
     */
    @GetMapping("/{id}/scoreboard")
    public ApiResponse<PublicScoreboardVO> getPublicScoreboard(@PathVariable long id) {
        return ApiResponse.ok(contestService.getPublicScoreboard(id));
    }
}
