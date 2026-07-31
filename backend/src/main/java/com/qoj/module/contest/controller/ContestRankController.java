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

/**
 * 比赛排名接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/contests")
public class ContestRankController {
    private final ContestAcmRankService acmRankService;
    private final ContestOiRankService oiRankService;
    private final ContestScoreboardSnapshotService snapshotService;
    private final ContestMapper contestMapper;

    /**
     * 构造 比赛排名Controller 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
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
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
