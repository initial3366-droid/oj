package com.qoj.module.contest.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestScoreboardSnapshot;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.service.ContestAcmRankService;
import com.qoj.module.contest.service.ContestOiRankService;
import com.qoj.module.contest.service.ContestScoreboardSnapshotService;
import com.qoj.module.contest.vo.ContestAcmRankVO;
import com.qoj.module.contest.vo.ContestOiRankVO;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/contests")
public class ContestRankController {
    private final ContestAcmRankService acmRankService;
    private final ContestOiRankService oiRankService;
    private final ContestScoreboardSnapshotService snapshotService;
    private final ContestMapper contestMapper;

    public ContestRankController(
        ContestAcmRankService acmRankService,
        ContestOiRankService oiRankService,
        ContestScoreboardSnapshotService snapshotService,
        ContestMapper contestMapper
    ) {
        this.acmRankService = acmRankService;
        this.oiRankService = oiRankService;
        this.snapshotService = snapshotService;
        this.contestMapper = contestMapper;
    }

    /**
     * 统一榜单接口
     * GET /api/v1/contests/{contestId}/rank?mode=ACM/OI
     */
    @GetMapping("/{contestId}/rank")
    public ApiResponse<?> getRank(
        @PathVariable Long contestId,
        @RequestParam(required = false) String mode
    ) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        // 如果没有指定 mode，使用比赛的类型
        String rankMode = mode != null ? mode.toUpperCase() : contest.type;

        if ("ACM".equals(rankMode)) {
            List<ContestAcmRankVO> ranks = acmRankService.getRankList(contestId);
            return ApiResponse.ok(ranks);
        } else if ("OI".equals(rankMode)) {
            List<ContestOiRankVO> ranks = oiRankService.getRankList(contestId);
            return ApiResponse.ok(ranks);
        } else {
            throw new BizException(ErrorCode.BAD_REQUEST, "无效的榜单模式，必须是 ACM 或 OI");
        }
    }

    /**
     * 获取榜单快照
     * GET /api/v1/contests/{contestId}/scoreboard/snapshot/{type}
     */
    @GetMapping("/{contestId}/scoreboard/snapshot/{type}")
    public ApiResponse<ContestScoreboardSnapshot> getSnapshot(
        @PathVariable Long contestId,
        @PathVariable String type
    ) {
        ContestScoreboardSnapshot snapshot = snapshotService.getSnapshot(contestId, type);
        return ApiResponse.ok(snapshot);
    }
}
