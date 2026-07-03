package com.qoj.module.contest.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestScoreboardSnapshot;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestScoreboardSnapshotMapper;
import com.qoj.module.contest.vo.ContestScoreboardVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class ContestScoreboardSnapshotService {
    private final ContestScoreboardSnapshotMapper snapshotMapper;
    private final ContestMapper contestMapper;
    private final ContestService contestService;
    private final ObjectMapper objectMapper;

    public ContestScoreboardSnapshotService(
        ContestScoreboardSnapshotMapper snapshotMapper,
        ContestMapper contestMapper,
        ContestService contestService,
        ObjectMapper objectMapper
    ) {
        this.snapshotMapper = snapshotMapper;
        this.contestMapper = contestMapper;
        this.contestService = contestService;
        this.objectMapper = objectMapper;
    }

    /**
     * 创建榜单快照
     */
    @Transactional(rollbackFor = Exception.class)
    public ContestScoreboardSnapshot createSnapshot(Long contestId, String snapshotType) {
        return saveSnapshot(contestId, snapshotType, false);
    }

    @Transactional(rollbackFor = Exception.class)
    public ContestScoreboardSnapshot upsertSnapshot(Long contestId, String snapshotType) {
        return saveSnapshot(contestId, snapshotType, true);
    }

    private ContestScoreboardSnapshot saveSnapshot(Long contestId, String snapshotType, boolean overwrite) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            throw new BizException(404, "比赛不存在");
        }
        String normalizedType = normalizeSnapshotType(snapshotType);

        // 检查是否已存在该类型的快照
        ContestScoreboardSnapshot existing = snapshotMapper.selectOne(
            new LambdaQueryWrapper<ContestScoreboardSnapshot>()
                .eq(ContestScoreboardSnapshot::getContestId, contestId)
                .eq(ContestScoreboardSnapshot::getSnapshotType, normalizedType)
        );

        if (existing != null && !overwrite) {
            throw new BizException(400, "该类型的快照已存在，请先删除旧快照");
        }

        String scoringMode = contest.scoringMode != null ? contest.scoringMode : contest.type;
        ContestScoreboardVO scoreboard = contestService.scoreboardForSnapshot(contestId, normalizedType);
        String data = serializeScoreboard(scoreboard);

        ContestScoreboardSnapshot snapshot = existing == null ? new ContestScoreboardSnapshot() : existing;
        snapshot.contestId = contestId;
        snapshot.scoringMode = scoringMode;
        snapshot.snapshotType = normalizedType;
        snapshot.data = data;
        AuthUser user = CurrentUser.get();
        snapshot.generatedBy = user == null ? null : user.id();

        if (snapshot.id == null) {
            snapshot.createdAt = LocalDateTime.now();
            snapshotMapper.insert(snapshot);
        } else {
            snapshotMapper.updateById(snapshot);
        }
        return snapshot;
    }

    /**
     * 获取榜单快照
     */
    public ContestScoreboardSnapshot getSnapshot(Long contestId, String snapshotType) {
        String normalizedType = normalizeSnapshotType(snapshotType);
        return snapshotMapper.selectOne(
            new LambdaQueryWrapper<ContestScoreboardSnapshot>()
                .eq(ContestScoreboardSnapshot::getContestId, contestId)
                .eq(ContestScoreboardSnapshot::getSnapshotType, normalizedType)
        );
    }

    /**
     * 删除榜单快照
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteSnapshot(Long contestId, String snapshotType) {
        String normalizedType = normalizeSnapshotType(snapshotType);
        snapshotMapper.delete(
            new LambdaQueryWrapper<ContestScoreboardSnapshot>()
                .eq(ContestScoreboardSnapshot::getContestId, contestId)
                .eq(ContestScoreboardSnapshot::getSnapshotType, normalizedType)
        );
    }

    private String serializeScoreboard(ContestScoreboardVO scoreboard) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(scoreboard);
        } catch (Exception e) {
            throw new BizException(500, "序列化榜单失败: " + e.getMessage());
        }
    }

    private String normalizeSnapshotType(String snapshotType) {
        String normalized = snapshotType == null ? "" : snapshotType.trim().toLowerCase();
        if (!("freeze".equals(normalized) || "final".equals(normalized))) {
            throw new BizException(400, "快照类型必须是 freeze 或 final");
        }
        return normalized;
    }
}
