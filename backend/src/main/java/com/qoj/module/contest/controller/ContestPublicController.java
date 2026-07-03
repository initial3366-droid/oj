package com.qoj.module.contest.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.contest.service.ContestService;
import com.qoj.module.contest.vo.PublicScoreboardVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/contests/public")
public class ContestPublicController {
    private final ContestService contestService;

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
