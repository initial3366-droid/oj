package com.qoj.module.user.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.entity.UserScore;
import com.qoj.module.user.mapper.UserScoreMapper;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * 用户分数业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class UserScoreService {
    private final UserScoreMapper userScoreMapper;
    private final SubmissionMapper submissionMapper;

    /**
     * 构造 用户分数Service 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public UserScoreService(UserScoreMapper userScoreMapper, SubmissionMapper submissionMapper) {
        this.userScoreMapper = userScoreMapper;
        this.submissionMapper = submissionMapper;
    }

    /**
     * 封装recompute相关逻辑。执行持久化写入。
     */
    public void recompute(Long userId) {
        if (userId == null) {
            return;
        }
        Long submitCount = submissionMapper.selectCount(
            new QueryWrapper<Submission>().eq("user_id", userId).isNull("contest_id")
        );
        Long acceptedProblems = submissionMapper.countAcceptedProblemsByUserId(userId);
        int solved = Math.toIntExact(acceptedProblems == null ? 0 : acceptedProblems);
        UserScore score = userScoreMapper.selectById(userId);
        boolean insert = score == null;
        if (insert) {
            score = new UserScore();
            score.userId = userId;
            score.streak = 0;
        }
        score.submitCount = Math.toIntExact(submitCount == null ? 0 : submitCount);
        score.acCount = solved;
        score.totalScore = solved * 100;
        score.rating = 0;
        score.streak = computeTrainingStreak(userId);
        if (insert) {
            userScoreMapper.insert(score);
        } else {
            userScoreMapper.updateById(score);
        }
    }

    /**
     * 计算TrainingStreak。从持久化层读取数据。
     */
    private int computeTrainingStreak(Long userId) {
        List<LocalDate> dates = submissionMapper.selectFirstAcceptedProblemDatesByUserId(userId);
        if (dates == null || dates.isEmpty()) {
            return 0;
        }
        Set<LocalDate> acceptedDates = new HashSet<>(dates);
        LocalDate cursor = LocalDate.now();
        if (!acceptedDates.contains(cursor)) {
            cursor = cursor.minusDays(1);
        }
        int streak = 0;
        while (acceptedDates.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }
}
