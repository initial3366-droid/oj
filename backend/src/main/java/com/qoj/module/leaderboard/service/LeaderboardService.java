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
import com.qoj.module.user.service.UserScoreService;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.entity.UserScore;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.mapper.UserScoreMapper;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.TeacherMapper;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 排行榜业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class LeaderboardService {
    private static final int DAILY_LIMIT = 10;
    private static final int CLASS_CACHE_LIMIT = 5000;
    private static final Duration CLASS_CACHE_TTL = Duration.ofMinutes(1);

    private final UserScoreMapper userScoreMapper;
    private final UserMapper userMapper;
    private final ClassRoomMapper classRoomMapper;
    private final ClassMemberMapper classMemberMapper;
    private final UserScoreService userScoreService;
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
        UserScoreService userScoreService,
        StringRedisTemplate redisTemplate,
        ObjectMapper objectMapper,
        TeacherMapper teacherMapper
    ) {
        this.userScoreMapper = userScoreMapper;
        this.userMapper = userMapper;
        this.classRoomMapper = classRoomMapper;
        this.classMemberMapper = classMemberMapper;
        this.userScoreService = userScoreService;
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
        Integer streak = userScoreService.trainingStreak(userId);
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
        List<ClassRankVO> cached = normalizedLimit <= CLASS_CACHE_LIMIT ? cachedClassRanking() : List.of();
        if (!cached.isEmpty()) {
            return cached.subList(0, Math.min(normalizedLimit, cached.size()));
        }
        List<ClassRankVO> result = computeClassRanking(Math.max(normalizedLimit, CLASS_CACHE_LIMIT));
        if (normalizedLimit <= CLASS_CACHE_LIMIT) cacheClassRanking(result);
        return result.subList(0, Math.min(normalizedLimit, result.size()));
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
        cacheClassRanking(computeClassRanking(CLASS_CACHE_LIMIT));
    }

    private void cacheClassRanking(List<ClassRankVO> result) {
        try {
            redisTemplate.opsForValue().set(RedisKeys.leaderboardClass(), objectMapper.writeValueAsString(result), CLASS_CACHE_TTL);
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
                Integer streak = userScoreService.trainingStreak(score.userId);
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
            // Use the same non-contest AC counters displayed by the individual leaderboard.
            int totalAc = Math.toIntExact(userScoreMapper.selectList(
                new QueryWrapper<UserScore>().in("user_id", memberIds)
            ).stream().mapToLong(score -> score.acCount == null ? 0 : score.acCount.longValue()).sum());

            String teacherName = "";
            if (classRoom.teacherId != null) {
                Teacher teacher = teacherMapper.selectById(classRoom.teacherId);
                teacherName = teacher != null && teacher.displayName != null ? teacher.displayName : "";
            }

            result.add(new ClassRankVO(classRoom.id, classRoom.name, memberIds.size(), totalAc, teacherName));
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

    private boolean isStudentUser(Long userId) {
        User user = userMapper.selectById(userId);
        return user != null && UserRole.STUDENT.name().equals(user.role);
    }
}
