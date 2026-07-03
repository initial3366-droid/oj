package com.qoj.module.contest.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.*;
import com.qoj.module.contest.mapper.*;
import com.qoj.module.contest.vo.AcmProblemStatusVO;
import com.qoj.module.contest.vo.ContestAcmRankVO;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ContestAcmRankService {
    private final ContestAcmRankCacheMapper acmRankCacheMapper;
    private final ContestAcmRankProblemMapper acmRankProblemMapper;
    private final ContestParticipantMapper participantMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final SubmissionMapper submissionMapper;
    private final ContestMapper contestMapper;
    private final UserMapper userMapper;

    public ContestAcmRankService(
        ContestAcmRankCacheMapper acmRankCacheMapper,
        ContestAcmRankProblemMapper acmRankProblemMapper,
        ContestParticipantMapper participantMapper,
        ContestProblemMapper contestProblemMapper,
        SubmissionMapper submissionMapper,
        ContestMapper contestMapper,
        UserMapper userMapper
    ) {
        this.acmRankCacheMapper = acmRankCacheMapper;
        this.acmRankProblemMapper = acmRankProblemMapper;
        this.participantMapper = participantMapper;
        this.contestProblemMapper = contestProblemMapper;
        this.submissionMapper = submissionMapper;
        this.contestMapper = contestMapper;
        this.userMapper = userMapper;
    }

    /**
     * 判题后更新 ACM 排名（幂等）
     */
    @Transactional(rollbackFor = Exception.class)
    public void updateRankAfterJudge(Submission submission) {
        if (submission.contestId == null || submission.participantId == null) {
            return;
        }

        Contest contest = contestMapper.selectById(submission.contestId);
        if (contest == null || !"ACM".equals(contest.type)) {
            return;
        }
        if (!isRankedSubmission(contest, submission)) {
            return;
        }

        boolean countCe = contest.countCeAsPenalty != null && contest.countCeAsPenalty;
        boolean isAccepted = "AC".equals(submission.status) || "ACCEPTED".equals(submission.status);
        boolean isPenaltyStatus = isAccepted
            || "WA".equals(submission.status)
            || "WRONG_ANSWER".equals(submission.status)
            || "TLE".equals(submission.status)
            || "TIME_LIMIT_EXCEEDED".equals(submission.status)
            || "MLE".equals(submission.status)
            || "MEMORY_LIMIT_EXCEEDED".equals(submission.status)
            || "RE".equals(submission.status)
            || "RUNTIME_ERROR".equals(submission.status)
            || (countCe && "CE".equals(submission.status));

        if (!isPenaltyStatus) {
            // 非罚时状态（如 CE 且不计罚时），只更新总榜的提交次数和最后提交时间
            updateTotalRankSubmissionInfo(submission);
            return;
        }

        // 获取或创建单题状态
        ContestAcmRankProblem problemRank = acmRankProblemMapper.selectOne(
            new LambdaQueryWrapper<ContestAcmRankProblem>()
                .eq(ContestAcmRankProblem::getContestId, submission.contestId)
                .eq(ContestAcmRankProblem::getParticipantId, submission.participantId)
                .eq(ContestAcmRankProblem::getContestProblemId, submission.contestProblemId)
        );

        if (problemRank == null) {
            problemRank = new ContestAcmRankProblem();
            problemRank.contestId = submission.contestId;
            problemRank.participantId = submission.participantId;
            problemRank.contestProblemId = submission.contestProblemId;
            problemRank.isSolved = false;
            problemRank.wrongAttempts = 0;
            problemRank.lastSubmitTime = submission.submitTime;
            acmRankProblemMapper.insert(problemRank);
        }

        // 幂等检查：如果该题已经 AC，不再处理
        if (Boolean.TRUE.equals(problemRank.isSolved)) {
            // 只更新最后提交时间
            if (submission.submitTime.isAfter(problemRank.lastSubmitTime)) {
                problemRank.lastSubmitTime = submission.submitTime;
                acmRankProblemMapper.updateById(problemRank);
            }
            updateTotalRankSubmissionInfo(submission);
            return;
        }

        // 如果本次 AC
        if (isAccepted) {
            long solveMinutes = ChronoUnit.MINUTES.between(contest.startTime, submission.submitTime);
            problemRank.isSolved = true;
            problemRank.solveTimeMinutes = (int) solveMinutes;
            problemRank.firstAcSubmissionId = submission.id;
            problemRank.firstAcTime = submission.submitTime;
            problemRank.lastSubmitTime = submission.submitTime;
            acmRankProblemMapper.updateById(problemRank);

            // 更新总榜
            updateTotalRankAfterAc(submission, problemRank, contest.penaltyMinutes);
        } else {
            // WA/TLE/MLE/RE/CE(可选)
            problemRank.wrongAttempts++;
            problemRank.lastSubmitTime = submission.submitTime;
            acmRankProblemMapper.updateById(problemRank);

            // 更新总榜的提交次数和最后提交时间
            updateTotalRankSubmissionInfo(submission);
        }
    }

    /**
     * 更新总榜：AC 后增加过题数和罚时
     */
    private void updateTotalRankAfterAc(Submission submission, ContestAcmRankProblem problemRank, Integer penaltyMinutes) {
        ContestAcmRankCache rankCache = acmRankCacheMapper.selectOne(
            new LambdaQueryWrapper<ContestAcmRankCache>()
                .eq(ContestAcmRankCache::getContestId, submission.contestId)
                .eq(ContestAcmRankCache::getParticipantId, submission.participantId)
        );

        if (rankCache == null) {
            rankCache = new ContestAcmRankCache();
            rankCache.contestId = submission.contestId;
            rankCache.participantId = submission.participantId;
            rankCache.solvedCount = 0;
            rankCache.penaltyTime = 0;
            rankCache.submissionCount = 0;
            acmRankCacheMapper.insert(rankCache);
        }

        // 增加过题数
        rankCache.solvedCount++;

        // 罚时 = AC 时间 + 错误次数 * penalty_minutes
        int penalty = problemRank.solveTimeMinutes + problemRank.wrongAttempts * (penaltyMinutes != null ? penaltyMinutes : 20);
        rankCache.penaltyTime += penalty;

        // 更新最后 AC 时间和提交时间
        rankCache.lastAcTime = submission.submitTime;
        rankCache.lastSubmitTime = submission.submitTime;
        rankCache.submissionCount++;

        acmRankCacheMapper.updateById(rankCache);

        // 重新计算排名
        recalculateRanks(submission.contestId);
    }

    /**
     * 只更新提交次数和最后提交时间（用于非 AC 或 AC 后的提交）
     */
    private void updateTotalRankSubmissionInfo(Submission submission) {
        ContestAcmRankCache rankCache = acmRankCacheMapper.selectOne(
            new LambdaQueryWrapper<ContestAcmRankCache>()
                .eq(ContestAcmRankCache::getContestId, submission.contestId)
                .eq(ContestAcmRankCache::getParticipantId, submission.participantId)
        );

        if (rankCache == null) {
            rankCache = new ContestAcmRankCache();
            rankCache.contestId = submission.contestId;
            rankCache.participantId = submission.participantId;
            rankCache.solvedCount = 0;
            rankCache.penaltyTime = 0;
            rankCache.submissionCount = 0;
            acmRankCacheMapper.insert(rankCache);
        }

        rankCache.submissionCount++;
        rankCache.lastSubmitTime = submission.submitTime;
        acmRankCacheMapper.updateById(rankCache);
    }

    /**
     * 重新计算排名
     */
    private void recalculateRanks(Long contestId) {
        List<ContestAcmRankCache> ranks = acmRankCacheMapper.selectRankList(contestId);
        int currentRank = 1;
        for (ContestAcmRankCache rank : ranks) {
            ContestParticipant participant = participantMapper.selectById(rank.participantId);
            if (participant != null && Boolean.TRUE.equals(participant.starred)) {
                rank.rankNo = 0;
            } else {
                rank.rankNo = currentRank++;
            }
            acmRankCacheMapper.updateById(rank);
        }
    }

    /**
     * 全量重建 ACM 排名（从 submissions 表）
     */
    @Transactional(rollbackFor = Exception.class)
    public void rebuildRank(Long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            throw new BizException(404, "比赛不存在");
        }
        if (!"ACM".equals(contest.type)) {
            throw new BizException(400, "该比赛不是 ACM 赛制");
        }

        // 清空旧缓存
        acmRankCacheMapper.delete(new LambdaQueryWrapper<ContestAcmRankCache>()
            .eq(ContestAcmRankCache::getContestId, contestId));
        acmRankProblemMapper.delete(new LambdaQueryWrapper<ContestAcmRankProblem>()
            .eq(ContestAcmRankProblem::getContestId, contestId));

        // 获取所有比赛提交（按时间排序）
        List<Submission> submissions = submissionMapper.selectList(
            new LambdaQueryWrapper<Submission>()
                .eq(Submission::getContestId, contestId)
                .isNotNull(Submission::getParticipantId)
                .orderByAsc(Submission::getSubmitTime)
        );

        // 逐个处理提交
        for (Submission submission : submissions) {
            updateRankAfterJudge(submission);
        }
    }

    private boolean isRankedSubmission(Contest contest, Submission submission) {
        LocalDateTime submittedAt = submission.submitTime == null ? submission.createdAt : submission.submitTime;
        if (contest.startTime == null || contest.endTime == null || submittedAt == null) {
            return false;
        }
        return !submittedAt.isBefore(contest.startTime) && !submittedAt.isAfter(contest.endTime);
    }

    /**
     * 获取 ACM 榜单
     */
    public List<ContestAcmRankVO> getRankList(Long contestId) {
        List<ContestAcmRankCache> ranks = acmRankCacheMapper.selectRankList(contestId);

        // 获取所有参赛者信息
        Set<Long> participantIds = ranks.stream().map(r -> r.participantId).collect(Collectors.toSet());
        if (participantIds.isEmpty()) {
            return List.of();
        }

        Map<Long, ContestParticipant> participants = participantMapper.selectBatchIds(participantIds)
            .stream().collect(Collectors.toMap(p -> p.id, p -> p));

        // 获取所有用户信息
        Set<Long> userIds = participants.values().stream().map(p -> p.userId).collect(Collectors.toSet());
        Map<Long, User> users = userMapper.selectBatchIds(userIds)
            .stream().collect(Collectors.toMap(u -> u.id, u -> u));

        // 获取所有比赛题目
        List<ContestProblem> problems = contestProblemMapper.selectList(
            new LambdaQueryWrapper<ContestProblem>()
                .eq(ContestProblem::getContestId, contestId)
                .orderByAsc(ContestProblem::getDisplayOrder)
        );

        // 构建结果
        List<ContestAcmRankVO> result = new ArrayList<>();
        for (ContestAcmRankCache rank : ranks) {
            ContestParticipant participant = participants.get(rank.participantId);
            if (participant == null) continue;

            User user = users.get(participant.userId);

            // 获取该参赛者的所有单题状态
            List<ContestAcmRankProblem> problemRanks = acmRankProblemMapper.selectList(
                new LambdaQueryWrapper<ContestAcmRankProblem>()
                    .eq(ContestAcmRankProblem::getContestId, contestId)
                    .eq(ContestAcmRankProblem::getParticipantId, rank.participantId)
            );

            Map<Long, ContestAcmRankProblem> problemRankMap = problemRanks.stream()
                .collect(Collectors.toMap(p -> p.contestProblemId, p -> p));

            List<AcmProblemStatusVO> problemStatus = problems.stream()
                .map(p -> {
                    ContestAcmRankProblem pr = problemRankMap.get(p.id);
                    return new AcmProblemStatusVO(
                        p.id,
                        p.label,
                        pr != null ? pr.isSolved : false,
                        pr != null ? pr.wrongAttempts : 0,
                        pr != null ? pr.solveTimeMinutes : null
                    );
                })
                .collect(Collectors.toList());

            result.add(new ContestAcmRankVO(
                participant.id,
                participant.userId,
                participant.nickname,
                null, // organizationName - TODO
                rank.rankNo,
                rank.solvedCount,
                rank.penaltyTime,
                rank.submissionCount,
                rank.lastAcTime,
                problemStatus
            ));
        }

        return result;
    }
}
