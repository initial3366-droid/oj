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
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ContestAccessPolicy;
import com.qoj.security.policy.Permission;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/v1/contests")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','CLUB_ADMIN','TEACHER')")
public class AdminContestRankController {
    private final ContestAcmRankService acmRankService;
    private final ContestOiRankService oiRankService;
    private final ContestScoreboardSnapshotService snapshotService;
    private final ContestMapper contestMapper;
    private final ContestAccessPolicy contestAccessPolicy;

    public AdminContestRankController(
        ContestAcmRankService acmRankService,
        ContestOiRankService oiRankService,
        ContestScoreboardSnapshotService snapshotService,
        ContestMapper contestMapper,
        ContestAccessPolicy contestAccessPolicy
    ) {
        this.acmRankService = acmRankService;
        this.oiRankService = oiRankService;
        this.snapshotService = snapshotService;
        this.contestMapper = contestMapper;
        this.contestAccessPolicy = contestAccessPolicy;
    }

    /**
     * 重建榜单（管理员）
     * POST /api/admin/v1/contests/{contestId}/rank/rebuild?mode=ACM/OI
     */
    @PostMapping("/{contestId}/rank/rebuild")
    public ApiResponse<Void> rebuildRank(
        @PathVariable Long contestId,
        @RequestParam String mode
    ) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!contestAccessPolicy.can(user, Permission.UPDATE, contest)) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权重建该比赛榜单");
        }

        if ("ACM".equalsIgnoreCase(mode)) {
            acmRankService.rebuildRank(contestId);
        } else if ("OI".equalsIgnoreCase(mode)) {
            oiRankService.rebuildRank(contestId);
        } else {
            throw new BizException(ErrorCode.BAD_REQUEST, "无效的榜单模式，必须是 ACM 或 OI");
        }

        return ApiResponse.ok();
    }

    /**
     * 创建榜单快照（管理员）
     * POST /api/admin/v1/contests/{contestId}/scoreboard/snapshot?type=FROZEN/FINAL/CUSTOM
     */
    @PostMapping("/{contestId}/scoreboard/snapshot")
    public ApiResponse<ContestScoreboardSnapshot> createSnapshot(
        @PathVariable Long contestId,
        @RequestParam String type
    ) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!contestAccessPolicy.can(user, Permission.UPDATE, contest)) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权创建该比赛榜单快照");
        }

        ContestScoreboardSnapshot snapshot = snapshotService.createSnapshot(contestId, type);
        return ApiResponse.ok(snapshot);
    }

    /**
     * 删除榜单快照（管理员）
     * DELETE /api/admin/v1/contests/{contestId}/scoreboard/snapshot/{type}
     */
    @DeleteMapping("/{contestId}/scoreboard/snapshot/{type}")
    public ApiResponse<Void> deleteSnapshot(
        @PathVariable Long contestId,
        @PathVariable String type
    ) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!contestAccessPolicy.can(user, Permission.UPDATE, contest)) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权删除该比赛榜单快照");
        }

        snapshotService.deleteSnapshot(contestId, type);
        return ApiResponse.ok();
    }
}
