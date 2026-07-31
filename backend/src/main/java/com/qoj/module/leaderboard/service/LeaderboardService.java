package com.qoj.module.leaderboard.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.enums.UserRole;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.entity.ClassRoom;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.leaderboard.vo.ClassRankVO;
import com.qoj.module.leaderboard.vo.RatingUserVO;
import com.qoj.module.leaderboard.vo.UserRankVO;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.entity.UserScore;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.mapper.UserScoreMapper;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.TeacherMapper;
import jakarta.annotation.PostConstruct;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 排行榜业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class LeaderboardService {
    private static final int DAILY_LIMIT = 10;

    private final UserScoreMapper userScoreMapper;
    private final UserMapper userMapper;
    private final ClassRoomMapper classRoomMapper;
    private final ClassMemberMapper classMemberMapper;
    private final SubmissionMapper submissionMapper;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final TeacherMapper teacherMapper;

    /**
     * 构造 排行榜Service 实例并保存其必要依赖或初始状态。从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态。
     */
    public LeaderboardService(
        UserScoreMapper userScoreMapper,
        UserMapper userMapper,
        ClassRoomMapper classRoomMapper,
        ClassMemberMapper classMemberMapper,
        SubmissionMapper submissionMapper,
        StringRedisTemplate redisTemplate,
        ObjectMapper objectMapper,
        TeacherMapper teacherMapper
    ) {
        this.userScoreMapper = userScoreMapper;
        this.userMapper = userMapper;
        this.classRoomMapper = classRoomMapper;
        this.classMemberMapper = classMemberMapper;
        this.submissionMapper = submissionMapper;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.teacherMapper = teacherMapper;
    }

    public List<RatingUserVO> global(int limit) {
        int normalizedLimit = Math.max(1, limit);
        if (normalizedLimit <= DAILY_LIMIT) {
            List<RatingUserVO> cached = cachedGlobal();
            if (!cached.isEmpty()) {
                return cached.subList(0, Math.min(normalizedLimit, cached.size()));
            }
        }
        /**
         * 计算Global。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return computeGlobal(normalizedLimit);
    }

    public List<UserRankVO> userRank(long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "用户不存在");
        }
        if (!UserRole.STUDENT.name().equals(user.role)) {
            return List.of();
        }
        UserScore score = userScoreMapper.selectById(userId);
        if (score == null) {
            return List.of();
        }
        Long rank = userScoreMapper.selectCount(
            new QueryWrapper<UserScore>()
                .gt("ac_count", score.acCount)
                .inSql("user_id", "SELECT id FROM users WHERE role = 'STUDENT'")
        );
        Integer acCount = score.acCount == null ? 0 : score.acCount.intValue();
        Integer streak = trainingStreak(userId);
        Integer weekAcCount = weekAcCount(userId);
        String className = getClassName(userId);
        return List.of(new UserRankVO(
            userId,
            user.displayName,
            user.avatarUrl,
            className,
            acCount,
            streak,
            weekAcCount,
            rank == null ? 1L : rank + 1
        ));
    }

    public List<ClassRankVO> classRanking(int limit) {
        int normalizedLimit = Math.max(1, limit);
        List<ClassRankVO> cached = cachedClassRanking();
        if (!cached.isEmpty()) {
            // 如果缓存中第一条记录缺少 teacherName（旧格式缓存），则重新计算
            if (cached.get(0).teacherName() != null) {
                return cached.subList(0, Math.min(normalizedLimit, cached.size()));
            }
        }
        /**
         * 计算班级Ranking。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return computeClassRanking(normalizedLimit);
    }

    @PostConstruct
    public void init() {
        refreshGlobalCache();
        refreshClassRankingCache();
    }

    @Scheduled(cron = "0 0 0 * * *")
    public void refreshAllCaches() {
        refreshGlobalCache();
        refreshClassRankingCache();
    }

    public void refreshGlobalCache() {
        List<RatingUserVO> result = computeGlobal(1000);
        try {
            redisTemplate.opsForValue().set(RedisKeys.leaderboardGlobal(), objectMapper.writeValueAsString(result));
        } catch (Exception ignored) {
        }
    }

    public void refreshClassRankingCache() {
        List<ClassRankVO> result = computeClassRanking(5000);
        try {
            redisTemplate.opsForValue().set(RedisKeys.leaderboardClass(), objectMapper.writeValueAsString(result));
        } catch (Exception ignored) {
        }
    }

    private List<RatingUserVO> cachedGlobal() {
        try {
            String json = redisTemplate.opsForValue().get(RedisKeys.leaderboardGlobal());
            if (json == null || json.isBlank() || !json.contains("\"avatarUrl\"")) {
                return List.of();
            }
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<ClassRankVO> cachedClassRanking() {
        try {
            String json = redisTemplate.opsForValue().get(RedisKeys.leaderboardClass());
            if (json == null || json.isBlank()) {
                return List.of();
            }
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<RatingUserVO> computeGlobal(int limit) {
        List<UserScore> scores = userScoreMapper.selectList(
            new QueryWrapper<UserScore>()
                .orderByDesc("ac_count")
                .last("LIMIT 5000")
        );
        return scores.stream()
            .filter(score -> isStudentUser(score.userId))
            .map(score -> {
                User user = userMapper.selectById(score.userId);
                String name = user == null ? String.valueOf(score.userId) : user.displayName;
                String className = user == null ? "" : getClassName(user.id);
                Integer acCount = score.acCount == null ? 0 : score.acCount.intValue();
                Integer streak = trainingStreak(score.userId);
                Integer weekAcCount = weekAcCount(score.userId);
                /**
                 * 封装Rating用户VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                String avatarUrl = user == null ? null : user.avatarUrl;
                return new RatingUserVO(score.userId, name, avatarUrl, className, acCount, streak, weekAcCount);
            })
            .limit(limit)
            .toList();
    }

    private List<ClassRankVO> computeClassRanking(int limit) {
        List<ClassRoom> classes = classRoomMapper.selectList(
            new QueryWrapper<ClassRoom>().orderByDesc("created_at")
        );

        List<ClassRankVO> result = new ArrayList<>();
        for (ClassRoom classRoom : classes) {
            List<ClassMember> members = classMemberMapper.selectList(
                new QueryWrapper<ClassMember>().eq("class_id", classRoom.id)
            );
            if (members.isEmpty()) {
                continue;
            }

            List<Long> memberIds = members.stream()
                .map(m -> m.userId)
                .filter(this::isStudentUser)
                .toList();
            if (memberIds.isEmpty()) {
                continue;
            }
            Integer totalAc = submissionMapper.countAcceptedProblemsByUserIds(memberIds);

            String teacherName = "";
            if (classRoom.teacherId != null) {
                Teacher teacher = teacherMapper.selectById(classRoom.teacherId);
                teacherName = teacher != null && teacher.displayName != null ? teacher.displayName : "";
            }

            result.add(new ClassRankVO(classRoom.id, classRoom.name, memberIds.size(), totalAc == null ? 0 : totalAc, teacherName));
        }

        return result.stream()
            .sorted((a, b) -> b.acCount() - a.acCount())
            .limit(limit)
            .toList();
    }

    private String getClassName(Long userId) {
        User user = userMapper.selectById(userId);
        if (user != null && user.classId != null) {
            ClassRoom classRoom = classRoomMapper.selectById(user.classId);
            if (classRoom != null) {
                return classRoom.name;
            }
        }
        ClassMember member = classMemberMapper.selectOne(
            new QueryWrapper<ClassMember>().eq("user_id", userId).last("LIMIT 1")
        );
        if (member != null) {
            ClassRoom classRoom = classRoomMapper.selectById(member.classId);
            return classRoom == null ? "" : classRoom.name;
        }
        return "";
    }

    private Integer weekAcCount(Long userId) {
        return 0;
    }

    private int trainingStreak(Long userId) {
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

    private boolean isStudentUser(Long userId) {
        User user = userMapper.selectById(userId);
        return user != null && UserRole.STUDENT.name().equals(user.role);
    }
}
