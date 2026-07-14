package com.qoj.module.leaderboard.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.leaderboard.service.LeaderboardService;
import com.qoj.module.leaderboard.vo.ClassRankVO;
import com.qoj.module.leaderboard.vo.RatingUserVO;
import com.qoj.module.leaderboard.vo.UserRankVO;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 排行榜接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/leaderboard")
public class LeaderboardController {
    private final LeaderboardService leaderboardService;

    /**
     * 构造 排行榜Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public LeaderboardController(LeaderboardService leaderboardService) {
        this.leaderboardService = leaderboardService;
    }

    /**
     * 封装global相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/global")
    public ApiResponse<List<RatingUserVO>> global(@RequestParam(defaultValue = "10") int limit) {
        return ApiResponse.ok(leaderboardService.global(limit));
    }

    /**
     * 封装班级Ranking相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/classes")
    public ApiResponse<List<ClassRankVO>> classRanking(@RequestParam(defaultValue = "100") int limit) {
        return ApiResponse.ok(leaderboardService.classRanking(limit));
    }

    /**
     * 封装r排名相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/user/{id}")
    public ApiResponse<List<UserRankVO>> userRank(@PathVariable long id) {
        return ApiResponse.ok(leaderboardService.userRank(id));
    }
}
