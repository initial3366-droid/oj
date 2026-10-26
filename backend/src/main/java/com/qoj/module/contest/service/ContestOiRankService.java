package com.qoj.module.contest.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.*;
import com.qoj.module.contest.mapper.*;
import com.qoj.module.contest.vo.ContestOiRankVO;
import com.qoj.module.contest.vo.OiProblemScoreVO;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 比赛Oi排名业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class ContestOiRankService {
    private final ContestOiRankCacheMapper oiRankCacheMapper;
    private final ContestOiRankProblemMapper oiRankProblemMapper;
    private final ContestParticipantMapper participantMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final SubmissionMapper submissionMapper;
    private final ContestMapper contestMapper;

    /**
     * 构造 比赛Oi排名Service 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public ContestOiRankService(
        ContestOiRankCacheMapper oiRankCacheMapper,
        ContestOiRankProblemMapper oiRankProblemMapper,
        ContestParticipantMapper participantMapper,
        ContestProblemMapper contestProblemMapper,
        SubmissionMapper submissionMapper,
        ContestMapper contestMapper
    ) {
        this.oiRankCacheMapper = oiRankCacheMapper;
        this.oiRankProblemMapper = oiRankProblemMapper;
        this.participantMapper = participantMapper;
        this.contestProblemMapper = contestProblemMapper;
        this.submissionMapper = submissionMapper;
        this.contestMapper = contestMapper;
    }

    /**
     * 判题后更新 OI 排名（幂等）
     */
    @Transactional(rollbackFor = Exception.class)
    public void updateRankAfterJudge(Submission submission) {
        if (submission.contestId == null || submission.participantId == null) {
            return;
        }

        Contest contest = contestMapper.selectById(submission.contestId);
        if (contest == null || !ContestFeedbackPolicy.usesScores(contest)) {
            return;
        }
        if (!ContestRankTimePolicy.isRankedSubmission(contest, submission)) {
            return;
        }

        if (ContestFeedbackPolicy.isLanqiao(contest)) {
            Submission latest = submissionMapper.selectOne(new QueryWrapper<Submission>()
                .eq("contest_id", submission.contestId)
                .eq("participant_id", submission.participantId)
                .eq("contest_problem_id", submission.contestProblemId)
                .ge("submit_time", contest.startTime)
                .le("submit_time", contest.endTime)
                .orderByDesc("submit_time", "id").last("LIMIT 1"));
            if (latest != null && !latest.id.equals(submission.id)) {
                return;
            }
        }

        // 获取题目满分
        ContestProblem contestProblem = contestProblemMapper.selectById(submission.contestProblemId);
        if (contestProblem == null) {
            return;
        }

        int fullScore = contestProblem.fullScore != null ? contestProblem.fullScore : 100;
        int currentScore = submission.score != null ? submission.score : 0;

        // 获取或创建单题状态
        ContestOiRankProblem problemRank = oiRankProblemMapper.selectOne(
            new LambdaQueryWrapper<ContestOiRankProblem>()
                .eq(ContestOiRankProblem::getContestId, submission.contestId)
                .eq(ContestOiRankProblem::getParticipantId, submission.participantId)
                .eq(ContestOiRankProblem::getContestProblemId, submission.contestProblemId)
        );

        boolean isNewRecord = false;
        if (problemRank == null) {
            problemRank = new ContestOiRankProblem();
            problemRank.contestId = submission.contestId;
            problemRank.participantId = submission.participantId;
            problemRank.contestProblemId = submission.contestProblemId;
            problemRank.bestScore = 0;
            problemRank.fullScore = fullScore;
            problemRank.submissionCount = 0;
            oiRankProblemMapper.insert(problemRank);
            isNewRecord = true;
        }

        // 更新提交次数和最后提交时间
        problemRank.submissionCount++;
        problemRank.lastSubmitTime = submission.submitTime;

        // 幂等检查：如果当前分数没有超过历史最高分，不更新
        int oldBestScore = problemRank.bestScore != null ? problemRank.bestScore : 0;
        boolean scoreImproved = ContestFeedbackPolicy.isLanqiao(contest) || currentScore > oldBestScore;

        if (scoreImproved) {
            problemRank.bestScore = currentScore;
            problemRank.bestSubmissionId = submission.id;
            problemRank.lastScoreUpdateTime = submission.submitTime;

            // 如果是首次满分
            if (currentScore >= fullScore && problemRank.firstFullScoreTime == null) {
                problemRank.firstFullScoreTime = submission.submitTime;
            }
        }

        if (isNewRecord) {
            // 已经 insert 过了，现在 update
            oiRankProblemMapper.updateById(problemRank);
        } else {
            oiRankProblemMapper.updateById(problemRank);
        }

        // 更新总榜
        updateTotalRank(submission, scoreImproved ? currentScore - oldBestScore : 0);
    }

    /**
     * 更新总榜
     */
    private void updateTotalRank(Submission submission, int scoreDelta) {
        ContestOiRankCache rankCache = oiRankCacheMapper.selectOne(
            new LambdaQueryWrapper<ContestOiRankCache>()
                .eq(ContestOiRankCache::getContestId, submission.contestId)
                .eq(ContestOiRankCache::getParticipantId, submission.participantId)
        );

        if (rankCache == null) {
            rankCache = new ContestOiRankCache();
            rankCache.contestId = submission.contestId;
            rankCache.participantId = submission.participantId;
            rankCache.totalScore = 0;
            rankCache.solvedCount = 0;
            rankCache.submissionCount = 0;
            oiRankCacheMapper.insert(rankCache);
        }

        // 更新总分
        if (scoreDelta != 0) {
            rankCache.totalScore += scoreDelta;
            rankCache.lastScoreUpdateTime = submission.submitTime;
        }

        // 更新提交次数和最后提交时间
        rankCache.submissionCount++;
        rankCache.lastSubmitTime = submission.submitTime;

        oiRankCacheMapper.updateById(rankCache);

        // 重新计算满分题数和排名
        recalculateSolvedCountAndRanks(submission.contestId);
    }

    /**
     * 重新计算满分题数和排名
     */
    private void recalculateSolvedCountAndRanks(Long contestId) {
        // 统计每个参赛者的满分题数
        List<ContestOiRankProblem> allProblemRanks = oiRankProblemMapper.selectList(
            new LambdaQueryWrapper<ContestOiRankProblem>()
                .eq(ContestOiRankProblem::getContestId, contestId)
        );

        Map<Long, Integer> solvedCountMap = new HashMap<>();
        for (ContestOiRankProblem pr : allProblemRanks) {
            if (pr.bestScore != null && pr.fullScore != null && pr.bestScore >= pr.fullScore) {
                solvedCountMap.merge(pr.participantId, 1, Integer::sum);
            }
        }

        // 更新总榜的满分题数
        List<ContestOiRankCache> allRanks = oiRankCacheMapper.selectList(
            new LambdaQueryWrapper<ContestOiRankCache>()
                .eq(ContestOiRankCache::getContestId, contestId)
        );

        for (ContestOiRankCache rank : allRanks) {
            rank.solvedCount = solvedCountMap.getOrDefault(rank.participantId, 0);
            oiRankCacheMapper.updateById(rank);
        }

        // 重新排名
        List<ContestOiRankCache> sortedRanks = oiRankCacheMapper.selectRankList(contestId);
        Set<Long> participantIds = sortedRanks.stream()
            .map(rank -> rank.participantId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        Map<Long, ContestParticipant> participants = participantIds.isEmpty()
            ? Map.of()
            : participantMapper.selectBatchIds(participantIds).stream()
                .collect(Collectors.toMap(participant -> participant.id, participant -> participant));
        int currentRank = 1;
        for (ContestOiRankCache rank : sortedRanks) {
            ContestParticipant participant = participants.get(rank.participantId);
            if (participant != null && Boolean.TRUE.equals(participant.starred)) {
                rank.rankNo = 0;
            } else {
                rank.rankNo = currentRank++;
            }
            oiRankCacheMapper.updateById(rank);
        }
    }

    /**
     * 全量重建 OI 排名（从 submissions 表）
     */
    @Transactional(rollbackFor = Exception.class)
    public void rebuildRank(Long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "比赛不存在");
        }
        if (!ContestFeedbackPolicy.usesScores(contest)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "该比赛不是 OI 赛制");
        }

        // 清空旧缓存
        oiRankCacheMapper.delete(new LambdaQueryWrapper<ContestOiRankCache>()
            .eq(ContestOiRankCache::getContestId, contestId));
        oiRankProblemMapper.delete(new LambdaQueryWrapper<ContestOiRankProblem>()
            .eq(ContestOiRankProblem::getContestId, contestId));

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

    /**
     * 获取 OI 榜单
     */
    public List<ContestOiRankVO> getRankList(Long contestId) {
        List<ContestOiRankCache> ranks = oiRankCacheMapper.selectRankList(contestId);

        // 获取所有参赛者信息
        Set<Long> participantIds = ranks.stream().map(r -> r.participantId).collect(Collectors.toSet());
        if (participantIds.isEmpty()) {
            return List.of();
        }

        Map<Long, ContestParticipant> participants = participantMapper.selectBatchIds(participantIds)
            .stream().collect(Collectors.toMap(p -> p.id, p -> p));

        // 获取所有比赛题目
        List<ContestProblem> problems = contestProblemMapper.selectList(
            new LambdaQueryWrapper<ContestProblem>()
                .eq(ContestProblem::getContestId, contestId)
                .orderByAsc(ContestProblem::getDisplayOrder)
        );
        Map<Long, Map<Long, ContestOiRankProblem>> problemRanksByParticipant = oiRankProblemMapper.selectList(
                new LambdaQueryWrapper<ContestOiRankProblem>()
                    .eq(ContestOiRankProblem::getContestId, contestId)
                    .in(ContestOiRankProblem::getParticipantId, participantIds)
            ).stream()
            .collect(Collectors.groupingBy(
                ContestOiRankProblem::getParticipantId,
                Collectors.toMap(rank -> rank.contestProblemId, rank -> rank)
            ));

        // 构建结果
        List<ContestOiRankVO> result = new ArrayList<>();
        for (ContestOiRankCache rank : ranks) {
            ContestParticipant participant = participants.get(rank.participantId);
            if (participant == null) continue;

            Map<Long, ContestOiRankProblem> problemRankMap = problemRanksByParticipant
                .getOrDefault(rank.participantId, Map.of());

            List<OiProblemScoreVO> problemScores = problems.stream()
                .map(p -> {
                    ContestOiRankProblem pr = problemRankMap.get(p.id);
                    /**
                     * 封装Oi题目分数VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                     */
                    return new OiProblemScoreVO(
                        p.id,
                        p.label,
                        pr != null ? pr.bestScore : 0,
                        pr != null ? pr.fullScore : (p.fullScore != null ? p.fullScore : 100),
                        pr != null ? pr.submissionCount : 0
                    );
                })
                .collect(Collectors.toList());

            result.add(new ContestOiRankVO(
                participant.id,
                participant.userId,
                participant.nickname,
                null, // organizationName - TODO
                rank.rankNo,
                rank.totalScore,
                rank.solvedCount,
                rank.submissionCount,
                rank.lastScoreUpdateTime,
                problemScores
            ));
        }

        return result;
    }
}
