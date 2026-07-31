package com.qoj.module.contest.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestRollingState;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestRollingStateMapper;
import com.qoj.module.contest.vo.ContestRollingStateVO;
import com.qoj.module.contest.vo.ContestRollingStepVO;
import com.qoj.module.contest.vo.ContestScoreboardRowVO;
import com.qoj.module.contest.vo.ContestScoreboardVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ContestAccessPolicy;
import com.qoj.security.policy.Permission;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 比赛Rolling业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class ContestRollingService {
    private static final String STATUS_NOT_STARTED = "NOT_STARTED";
    private static final String STATUS_ROLLING = "ROLLING";
    private static final String STATUS_FINISHED = "FINISHED";
    private static final String STATUS_PUBLISHED = "PUBLISHED";

    private final ContestMapper contestMapper;
    private final ContestRollingStateMapper rollingStateMapper;
    private final ContestService contestService;
    private final ContestScoreboardSnapshotService snapshotService;
    private final ContestAccessPolicy contestAccessPolicy;
    private final ObjectMapper objectMapper;

    /**
     * 构造 比赛RollingService 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断；从持久化层读取数据。
     */
    public ContestRollingService(
        ContestMapper contestMapper,
        ContestRollingStateMapper rollingStateMapper,
        ContestService contestService,
        ContestScoreboardSnapshotService snapshotService,
        ContestAccessPolicy contestAccessPolicy,
        ObjectMapper objectMapper
    ) {
        this.contestMapper = contestMapper;
        this.rollingStateMapper = rollingStateMapper;
        this.contestService = contestService;
        this.snapshotService = snapshotService;
        this.contestAccessPolicy = contestAccessPolicy;
        this.objectMapper = objectMapper;
    }

    public ContestRollingStateVO getState(Long contestId) {
        requireManageContest(contestId);
        ContestRollingState state = rollingStateMapper.selectById(contestId);
        if (state == null) {
            /**
             * 封装比赛RollingStateVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new ContestRollingStateVO(contestId, STATUS_NOT_STARTED, 0, 0, false, List.of(), null, null, null);
        }
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(state);
    }

    @Transactional(rollbackFor = Exception.class)
    public ContestRollingStateVO start(Long contestId) {
        Contest contest = requireManageContest(contestId);
        validateRollingContest(contest);
        LocalDateTime now = LocalDateTime.now();
        AuthUser user = CurrentUser.required();
        List<ContestRollingStepVO> steps = generateSteps(contest);

        ContestRollingState state = rollingStateMapper.selectById(contestId);
        boolean insert = state == null;
        if (state == null) {
            state = new ContestRollingState();
            state.contestId = contestId;
            state.createdAt = now;
        }
        state.status = STATUS_ROLLING;
        state.currentStep = 0;
        state.totalSteps = steps.size();
        state.stepsJson = writeSteps(steps);
        state.startedBy = user.id();
        state.updatedBy = user.id();
        state.startedAt = now;
        state.publishedAt = null;
        state.updatedAt = now;
        if (insert) {
            rollingStateMapper.insert(state);
        } else {
            rollingStateMapper.updateById(state);
        }
        snapshotService.upsertSnapshot(contestId, "freeze");
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(state);
    }

    @Transactional(rollbackFor = Exception.class)
    public ContestRollingStateVO step(Long contestId, String direction) {
        requireManageContest(contestId);
        ContestRollingState state = requireState(contestId);
        if (STATUS_PUBLISHED.equals(state.status)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "最终榜已发布，不能继续调整滚榜步骤");
        }
        int current = state.currentStep == null ? 0 : state.currentStep;
        int total = state.totalSteps == null ? 0 : state.totalSteps;
        String normalized = direction == null ? "next" : direction.trim().toLowerCase();
        if ("prev".equals(normalized) || "previous".equals(normalized) || "back".equals(normalized)) {
            current = Math.max(0, current - 1);
        } else {
            current = Math.min(total, current + 1);
        }
        state.currentStep = current;
        state.status = STATUS_ROLLING;
        state.updatedBy = CurrentUser.required().id();
        state.updatedAt = LocalDateTime.now();
        rollingStateMapper.updateById(state);
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(state);
    }

    @Transactional(rollbackFor = Exception.class)
    public ContestRollingStateVO finish(Long contestId) {
        requireManageContest(contestId);
        ContestRollingState state = requireState(contestId);
        if (STATUS_PUBLISHED.equals(state.status)) {
            /**
             * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return toVO(state);
        }
        state.currentStep = state.totalSteps == null ? 0 : state.totalSteps;
        state.status = STATUS_FINISHED;
        state.updatedBy = CurrentUser.required().id();
        state.updatedAt = LocalDateTime.now();
        rollingStateMapper.updateById(state);
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(state);
    }

    @Transactional(rollbackFor = Exception.class)
    public ContestRollingStateVO publishFinal(Long contestId) {
        Contest contest = requireManageContest(contestId);
        validateRollingContest(contest);
        ContestRollingState state = rollingStateMapper.selectById(contestId);
        if (state == null) {
            List<ContestRollingStepVO> steps = generateSteps(contest);
            state = new ContestRollingState();
            state.contestId = contestId;
            state.stepsJson = writeSteps(steps);
            state.totalSteps = steps.size();
            state.createdAt = LocalDateTime.now();
            state.startedAt = LocalDateTime.now();
            state.startedBy = CurrentUser.required().id();
        }
        state.currentStep = state.totalSteps == null ? 0 : state.totalSteps;
        state.status = STATUS_PUBLISHED;
        state.publishedAt = LocalDateTime.now();
        state.updatedBy = CurrentUser.required().id();
        state.updatedAt = LocalDateTime.now();
        if (rollingStateMapper.selectById(contestId) == null) {
            rollingStateMapper.insert(state);
        } else {
            rollingStateMapper.updateById(state);
        }
        snapshotService.upsertSnapshot(contestId, "final");
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(state);
    }

    private Contest requireManageContest(Long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null || Boolean.TRUE.equals(contest.isDeleted)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }
        AuthUser user = CurrentUser.required();
        if (!contestAccessPolicy.can(user, Permission.MANAGE_SCOREBOARD, contest)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权管理该比赛榜单");
        }
        return contest;
    }

    private void validateRollingContest(Contest contest) {
        if (!Boolean.TRUE.equals(contest.enableRollingScoreboard)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "该比赛未启用滚榜");
        }
        if (!Boolean.TRUE.equals(contest.frozen) || contest.freezeTime == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "滚榜需要先开启封榜并设置封榜时间");
        }
        if (contest.endTime == null || !LocalDateTime.now().isAfter(contest.endTime)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "比赛结束后才能开始滚榜");
        }
    }

    private ContestRollingState requireState(Long contestId) {
        ContestRollingState state = rollingStateMapper.selectById(contestId);
        if (state == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "请先开始滚榜");
        }
        return state;
    }

    private List<ContestRollingStepVO> generateSteps(Contest contest) {
        ContestScoreboardVO frozenBoard = contestService.scoreboardForRolling(contest.id, false);
        ContestScoreboardVO finalBoard = contestService.scoreboardForRolling(contest.id, true);
        Map<String, ContestScoreboardRowVO> frozenRows = new LinkedHashMap<>();
        for (ContestScoreboardRowVO row : frozenBoard.rows()) {
            frozenRows.put(identityKey(row), row);
        }
        List<ContestScoreboardRowVO> ordered = new ArrayList<>(finalBoard.rows());
        ordered.sort((left, right) -> {
            int leftFrozenRank = frozenRankOrMax(left, frozenRows);
            int rightFrozenRank = frozenRankOrMax(right, frozenRows);
            int frozenCompare = Integer.compare(rightFrozenRank, leftFrozenRank);
            if (frozenCompare != 0) {
                return frozenCompare;
            }
            int leftFinalRank = left.rank() == null ? Integer.MAX_VALUE : left.rank();
            int rightFinalRank = right.rank() == null ? Integer.MAX_VALUE : right.rank();
            return Integer.compare(rightFinalRank, leftFinalRank);
        });

        List<ContestRollingStepVO> steps = new ArrayList<>();
        for (int i = 0; i < ordered.size(); i++) {
            ContestScoreboardRowVO finalRow = ordered.get(i);
            ContestScoreboardRowVO frozenRow = frozenRows.get(identityKey(finalRow));
            Integer frozenRank = frozenRow == null ? null : frozenRow.rank();
            Integer finalRank = finalRow.rank();
            Integer rankDelta = frozenRank == null || finalRank == null ? null : frozenRank - finalRank;
            steps.add(new ContestRollingStepVO(
                i + 1,
                finalRow.identityType(),
                finalRow.identityId(),
                finalRow.userId(),
                finalRow.displayName(),
                frozenRank,
                finalRank,
                finalRow.solved(),
                finalRow.penalty(),
                finalRow.score(),
                finalRow.medal(),
                rankDelta
            ));
        }
        return steps;
    }

    private int frozenRankOrMax(ContestScoreboardRowVO row, Map<String, ContestScoreboardRowVO> frozenRows) {
        ContestScoreboardRowVO frozenRow = frozenRows.get(identityKey(row));
        return frozenRow == null || frozenRow.rank() == null ? Integer.MAX_VALUE : frozenRow.rank();
    }

    private ContestRollingStateVO toVO(ContestRollingState state) {
        List<ContestRollingStepVO> steps = readSteps(state.stepsJson);
        /**
         * 封装比赛RollingStateVO相关逻辑。执行持久化写入；在状态变化后发布异步消息。
         */
        return new ContestRollingStateVO(
            state.contestId,
            state.status == null ? STATUS_NOT_STARTED : state.status,
            state.currentStep == null ? 0 : state.currentStep,
            state.totalSteps == null ? steps.size() : state.totalSteps,
            STATUS_PUBLISHED.equals(state.status),
            steps,
            state.startedAt,
            state.publishedAt,
            state.updatedAt
        );
    }

    private List<ContestRollingStepVO> readSteps(String stepsJson) {
        if (stepsJson == null || stepsJson.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(stepsJson, new TypeReference<List<ContestRollingStepVO>>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String writeSteps(List<ContestRollingStepVO> steps) {
        try {
            return objectMapper.writeValueAsString(steps);
        } catch (JsonProcessingException ex) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.INTERNAL_ERROR.getCode(), "生成滚榜步骤失败");
        }
    }

    private String identityKey(ContestScoreboardRowVO row) {
        String type = row.identityType() == null || row.identityType().isBlank() ? "PERSONAL" : row.identityType();
        Long id = row.identityId() == null ? row.userId() : row.identityId();
        return type + ":" + id;
    }
}
