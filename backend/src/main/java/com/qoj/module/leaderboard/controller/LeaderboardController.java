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

@RestController
@RequestMapping("/api/v1/leaderboard")
public class LeaderboardController {
    private final LeaderboardService leaderboardService;

    public LeaderboardController(LeaderboardService leaderboardService) {
        this.leaderboardService = leaderboardService;
    }

    @GetMapping("/global")
    public ApiResponse<List<RatingUserVO>> global(@RequestParam(defaultValue = "10") int limit) {
        return ApiResponse.ok(leaderboardService.global(limit));
    }

    @GetMapping("/classes")
    public ApiResponse<List<ClassRankVO>> classRanking(@RequestParam(defaultValue = "100") int limit) {
        return ApiResponse.ok(leaderboardService.classRanking(limit));
    }

    @GetMapping("/user/{id}")
    public ApiResponse<List<UserRankVO>> userRank(@PathVariable long id) {
        return ApiResponse.ok(leaderboardService.userRank(id));
    }
}
