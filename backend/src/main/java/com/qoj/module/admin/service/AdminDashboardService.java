package com.qoj.module.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.qoj.module.admin.vo.AdminDashboardContestVO;
import com.qoj.module.admin.vo.AdminDashboardVO;
import com.qoj.module.admin.vo.DashboardChartsVO;
import com.qoj.common.enums.UserRole;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 管理员仪表盘业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class AdminDashboardService {
    private final UserMapper userMapper;
    private final SubmissionMapper submissionMapper;
    private final ProblemMapper problemMapper;
    private final ContestMapper contestMapper;
    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;
    private final TeacherMapper teacherMapper;

    /**
     * 构造 管理员仪表盘Service 实例并保存其必要依赖或初始状态。从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态。
     */
    public AdminDashboardService(
        UserMapper userMapper,
        SubmissionMapper submissionMapper,
        ProblemMapper problemMapper,
        ContestMapper contestMapper,
        JdbcTemplate jdbcTemplate,
        StringRedisTemplate redisTemplate,
        TeacherMapper teacherMapper
    ) {
        this.userMapper = userMapper;
        this.submissionMapper = submissionMapper;
        this.problemMapper = problemMapper;
        this.contestMapper = contestMapper;
        this.jdbcTemplate = jdbcTemplate;
        this.redisTemplate = redisTemplate;
        this.teacherMapper = teacherMapper;
    }

    public AdminDashboardVO dashboard() {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime tomorrowStart = todayStart.plusDays(1);
        LocalDateTime weekAgo = todayStart.minusDays(6);
        LocalDateTime now = LocalDateTime.now();

        long userCount = userMapper.selectCount(new QueryWrapper<User>().in("role", activeFrontendRoles()))
            + teacherMapper.selectCount(new QueryWrapper<Teacher>().eq("status", "ACTIVE"));
        long problemCount = problemMapper.selectCount(new QueryWrapper<Problem>());
        long submissionCount = submissionMapper.selectCount(new QueryWrapper<Submission>());
        long todaySubmissions = submissionMapper.selectCount(
            new QueryWrapper<Submission>().ge("created_at", todayStart).lt("created_at", tomorrowStart)
        );
        long todayAccepted = todayAcceptedCount(todayStart, tomorrowStart);
        long todayActiveUsers = submissionMapper.countTodayActiveUsers(todayStart, tomorrowStart);

        return new AdminDashboardVO(
            onlineUserCount(),
            userCount,
            problemCount,
            submissionCount,
            todaySubmissions,
            todayAccepted,
            todayActiveUsers,
            contestMapper.selectCount(
                contestScopeWrapper().le("start_time", now).ge("end_time", now)
            ),
            recentContests(),
            buildTotalStats(userCount, problemCount, submissionCount),
            buildSubmissionTrend(weekAgo),
            buildVerdictDistribution(),
            buildLanguageUsage(submissionCount),
            buildDifficultyDistribution(),
            buildHourlyActivity(todayStart, tomorrowStart),
            buildUserGrowth(),
            buildTopProblems()
        );
    }

    private DashboardChartsVO.TotalStats buildTotalStats(long userCount, long problemCount, long submissionCount) {
        Map<String, Long> userByRole = new HashMap<>();
        for (Map<String, Object> row : userMapper.selectUserCountByRole()) {
            userByRole.put((String) row.get("role"), ((Number) row.get("count")).longValue());
        }
        userByRole.put("TEACHER", teacherMapper.selectCount(new QueryWrapper<Teacher>().eq("status", "ACTIVE")));

        Map<Integer, Long> problemByDifficulty = new TreeMap<>();
        for (Map<String, Object> row : problemMapper.selectDifficultyDistribution()) {
            problemByDifficulty.put(((Number) row.get("difficulty")).intValue(), ((Number) row.get("count")).longValue());
        }

        Map<String, Long> contestByType = new HashMap<>();
        for (Map<String, Object> row : contestMapper.selectContestCountByType()) {
            contestByType.put((String) row.get("type"), ((Number) row.get("count")).longValue());
        }

        long acCount = submissionMapper.countByStatus("AC");
        double passRate = submissionCount > 0 ? Math.round(acCount * 1000.0 / submissionCount) / 10.0 : 0;
        long contestCount = contestMapper.selectCount(new QueryWrapper<Contest>().eq("is_deleted", false));

        return new DashboardChartsVO.TotalStats(
            userCount, userByRole,
            problemCount, problemByDifficulty,
            submissionCount, passRate,
            contestCount, contestByType
        );
    }

    private List<DashboardChartsVO.DailySubmission> buildSubmissionTrend(LocalDateTime startDate) {
        Map<String, long[]> dayMap = new LinkedHashMap<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MM-dd");
        for (int i = 0; i < 7; i++) {
            dayMap.put(startDate.plusDays(i).toLocalDate().format(fmt), new long[]{0, 0});
        }
        for (Map<String, Object> row : submissionMapper.selectDailySubmissions(startDate)) {
            String date = row.get("date").toString();
            if (date.length() > 5) date = date.substring(5);
            long[] counts = dayMap.get(date);
            if (counts != null) {
                counts[0] = ((Number) row.get("total")).longValue();
                counts[1] = ((Number) row.get("accepted")).longValue();
            }
        }
        List<DashboardChartsVO.DailySubmission> result = new ArrayList<>();
        dayMap.forEach((date, c) -> result.add(new DashboardChartsVO.DailySubmission(date, c[0], c[1])));
        return result;
    }

    private List<DashboardChartsVO.VerdictCount> buildVerdictDistribution() {
        return submissionMapper.selectVerdictDistribution().stream()
            .map(row -> new DashboardChartsVO.VerdictCount(
                (String) row.get("status"), ((Number) row.get("count")).longValue()
            )).toList();
    }

    private List<DashboardChartsVO.LanguageCount> buildLanguageUsage(long totalSubmissions) {
        return submissionMapper.selectLanguageUsage().stream()
            .map(row -> {
                long count = ((Number) row.get("count")).longValue();
                double pct = totalSubmissions > 0 ? Math.round(count * 1000.0 / totalSubmissions) / 10.0 : 0;
                return new DashboardChartsVO.LanguageCount((String) row.get("language"), count, pct);
            }).toList();
    }

    private List<DashboardChartsVO.DifficultyCount> buildDifficultyDistribution() {
        return problemMapper.selectDifficultyDistribution().stream()
            .map(row -> new DashboardChartsVO.DifficultyCount(
                ((Number) row.get("difficulty")).intValue(), ((Number) row.get("count")).longValue()
            )).toList();
    }

    private List<DashboardChartsVO.HourlyCount> buildHourlyActivity(LocalDateTime todayStart, LocalDateTime tomorrowStart) {
        Map<Integer, Long> hourMap = new TreeMap<>();
        for (int i = 0; i < 24; i++) hourMap.put(i, 0L);
        for (Map<String, Object> row : submissionMapper.selectHourlyActivity(todayStart, tomorrowStart)) {
            hourMap.put(((Number) row.get("hour")).intValue(), ((Number) row.get("count")).longValue());
        }
        return hourMap.entrySet().stream()
            .map(e -> new DashboardChartsVO.HourlyCount(e.getKey(), e.getValue()))
            .toList();
    }

    private List<DashboardChartsVO.MonthlyUserCount> buildUserGrowth() {
        long cumulative = 0;
        List<DashboardChartsVO.MonthlyUserCount> result = new ArrayList<>();
        for (Map<String, Object> row : userMapper.selectMonthlyRegistrations()) {
            cumulative += ((Number) row.get("count")).longValue();
            result.add(new DashboardChartsVO.MonthlyUserCount((String) row.get("month"), cumulative));
        }
        return result;
    }

    private List<DashboardChartsVO.TopProblem> buildTopProblems() {
        return submissionMapper.selectTopProblems().stream()
            .map(row -> new DashboardChartsVO.TopProblem(
                ((Number) row.get("problem_id")).longValue(),
                (String) row.get("title"),
                ((Number) row.get("difficulty")).intValue(),
                ((Number) row.get("submissions")).longValue(),
                ((Number) row.get("ac_rate")).doubleValue()
            )).toList();
    }

    private long onlineUserCount() {
        Set<String> keys = redisTemplate.keys(RedisKeys.onlineUserPattern());
        return keys == null ? 0 : keys.size();
    }

    private long todayAcceptedCount(LocalDateTime todayStart, LocalDateTime tomorrowStart) {
        Long count = jdbcTemplate.queryForObject(
            "SELECT COUNT(DISTINCT user_id) FROM submissions WHERE status = 'AC' AND created_at >= ? AND created_at < ?",
            Long.class, todayStart, tomorrowStart
        );
        return count == null ? 0 : count;
    }

    private List<AdminDashboardContestVO> recentContests() {
        LocalDateTime now = LocalDateTime.now();
        return contestMapper.selectPage(Page.of(1, 5), contestScopeWrapper().orderByDesc("start_time"))
            .getRecords().stream()
            .map(contest -> {
                String status = "NOT_STARTED";
                if (contest.startTime != null && contest.endTime != null) {
                    if (now.isBefore(contest.startTime)) status = "NOT_STARTED";
                    else if (now.isAfter(contest.endTime)) status = "ENDED";
                    else status = "RUNNING";
                }
                /**
                 * 封装管理员仪表盘比赛VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                return new AdminDashboardContestVO(
                    contest.id, contest.title, contest.startTime, contest.endTime,
                    contest.type, contest.audience, status
                );
            }).toList();
    }

    private QueryWrapper<Contest> contestScopeWrapper() {
        AuthUser user = CurrentUser.required();
        QueryWrapper<Contest> wrapper = new QueryWrapper<Contest>().eq("is_deleted", false);
        if (!"SUPER_ADMIN".equals(user.role())) {
            wrapper.eq("owner_id", user.id())
                .eq("owner_account_type", user.accountType());
        }
        return wrapper;
    }

    private List<String> activeFrontendRoles() {
        return List.of(UserRole.STUDENT.name());
    }

    // ── Teacher-scoped dashboard ──

    public AdminDashboardVO teacherDashboard() {
        AuthUser teacher = CurrentUser.required();
        long teacherId = teacher.id();

        // 1. Get teacher's class IDs
        List<Long> classIds = jdbcTemplate.queryForList(
            "SELECT id FROM classes WHERE teacher_id = ?", Long.class, teacherId);

        if (classIds.isEmpty()) {
            /**
             * 封装empty教师仪表盘相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return emptyTeacherDashboard();
        }

        String classIdList = classIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
        String studentSub = "(SELECT cm.user_id FROM class_members cm WHERE cm.class_id IN (" + classIdList + "))";

        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime tomorrowStart = todayStart.plusDays(1);
        LocalDateTime weekAgo = todayStart.minusDays(6);
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MM-dd");

        // Student count
        long studentCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(DISTINCT user_id) FROM class_members WHERE class_id IN (" + classIdList + ")",
            Long.class);

        // Submission counts
        long submissionCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM submissions WHERE user_id IN " + studentSub, Long.class);
        long todaySubmissions = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM submissions WHERE user_id IN " + studentSub + " AND created_at >= ? AND created_at < ?",
            Long.class, todayStart, tomorrowStart);
        long todayAccepted = jdbcTemplate.queryForObject(
            "SELECT COUNT(DISTINCT user_id) FROM submissions WHERE user_id IN " + studentSub + " AND status = 'AC' AND created_at >= ? AND created_at < ?",
            Long.class, todayStart, tomorrowStart);
        long todayActiveUsers = jdbcTemplate.queryForObject(
            "SELECT COUNT(DISTINCT user_id) FROM submissions WHERE user_id IN " + studentSub + " AND created_at >= ? AND created_at < ?",
            Long.class, todayStart, tomorrowStart);

        // Problem count (problems that appear in submissions by teacher's students)
        long problemCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(DISTINCT problem_id) FROM submissions WHERE user_id IN " + studentSub, Long.class);

        // Contest count (owned by teacher)
        long contestCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM contests WHERE is_deleted = 0 AND owner_id = ? AND owner_account_type = 'TEACHER'",
            Long.class, teacherId);
        long activeContestCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM contests WHERE is_deleted = 0 AND owner_id = ? AND owner_account_type = 'TEACHER' AND start_time <= ? AND end_time >= ?",
            Long.class, teacherId, now, now);

        // TotalStats
        long acCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM submissions WHERE user_id IN " + studentSub + " AND status = 'AC'", Long.class);
        double passRate = submissionCount > 0 ? Math.round(acCount * 1000.0 / submissionCount) / 10.0 : 0;

        Map<String, Long> userByRole = new HashMap<>();
        userByRole.put("STUDENT", studentCount);

        Map<Integer, Long> problemByDifficulty = new TreeMap<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList(
            "SELECT p.difficulty, COUNT(DISTINCT p.id) AS cnt FROM problems p "
                + "INNER JOIN submissions s ON s.problem_id = p.id WHERE s.user_id IN " + studentSub
                + " AND p.is_deleted = 0 GROUP BY p.difficulty")) {
            problemByDifficulty.put(((Number) row.get("difficulty")).intValue(), ((Number) row.get("cnt")).longValue());
        }

        Map<String, Long> contestByType = new HashMap<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList(
            "SELECT type, COUNT(*) AS cnt FROM contests WHERE is_deleted = 0 AND owner_id = ? AND owner_account_type = 'TEACHER' GROUP BY type",
            teacherId)) {
            contestByType.put((String) row.get("type"), ((Number) row.get("cnt")).longValue());
        }

        DashboardChartsVO.TotalStats totalStats = new DashboardChartsVO.TotalStats(
            studentCount, userByRole, problemCount, problemByDifficulty,
            submissionCount, passRate, contestCount, contestByType);

        // Submission trend (7 days)
        Map<String, long[]> dayMap = new LinkedHashMap<>();
        for (int i = 0; i < 7; i++) {
            dayMap.put(weekAgo.plusDays(i).toLocalDate().format(fmt), new long[]{0, 0});
        }
        for (Map<String, Object> row : jdbcTemplate.queryForList(
            "SELECT DATE(created_at) AS date, COUNT(*) AS total, SUM(CASE WHEN status = 'AC' THEN 1 ELSE 0 END) AS accepted "
                + "FROM submissions WHERE user_id IN " + studentSub + " AND created_at >= ? GROUP BY DATE(created_at)",
            weekAgo)) {
            String date = row.get("date").toString();
            if (date.length() > 5) date = date.substring(5);
            long[] counts = dayMap.get(date);
            if (counts != null) {
                counts[0] = ((Number) row.get("total")).longValue();
                counts[1] = ((Number) row.get("accepted")).longValue();
            }
        }
        List<DashboardChartsVO.DailySubmission> submissionTrend = new ArrayList<>();
        dayMap.forEach((date, c) -> submissionTrend.add(new DashboardChartsVO.DailySubmission(date, c[0], c[1])));

        // Verdict distribution
        List<DashboardChartsVO.VerdictCount> verdictDistribution = jdbcTemplate.queryForList(
            "SELECT status, COUNT(*) AS count FROM submissions WHERE user_id IN " + studentSub + " AND status IS NOT NULL GROUP BY status")
            .stream().map(row -> new DashboardChartsVO.VerdictCount(
                (String) row.get("status"), ((Number) row.get("count")).longValue())).toList();

        // Language usage
        List<Map<String, Object>> langRows = jdbcTemplate.queryForList(
            "SELECT language, COUNT(*) AS count FROM submissions WHERE user_id IN " + studentSub + " AND language IS NOT NULL GROUP BY language ORDER BY count DESC");
        List<DashboardChartsVO.LanguageCount> languageUsage = langRows.stream()
            .map(row -> {
                long count = ((Number) row.get("count")).longValue();
                double pct = submissionCount > 0 ? Math.round(count * 1000.0 / submissionCount) / 10.0 : 0;
                return new DashboardChartsVO.LanguageCount((String) row.get("language"), count, pct);
            }).toList();

        // Difficulty distribution
        List<DashboardChartsVO.DifficultyCount> difficultyDistribution = jdbcTemplate.queryForList(
            "SELECT p.difficulty, COUNT(DISTINCT p.id) AS count FROM problems p "
                + "INNER JOIN submissions s ON s.problem_id = p.id WHERE s.user_id IN " + studentSub
                + " AND p.is_deleted = 0 GROUP BY p.difficulty ORDER BY p.difficulty")
            .stream().map(row -> new DashboardChartsVO.DifficultyCount(
                ((Number) row.get("difficulty")).intValue(), ((Number) row.get("count")).longValue())).toList();

        // Hourly activity
        Map<Integer, Long> hourMap = new TreeMap<>();
        for (int i = 0; i < 24; i++) hourMap.put(i, 0L);
        for (Map<String, Object> row : jdbcTemplate.queryForList(
            "SELECT HOUR(created_at) AS hour, COUNT(*) AS count FROM submissions "
                + "WHERE user_id IN " + studentSub + " AND created_at >= ? AND created_at < ? GROUP BY HOUR(created_at)",
            todayStart, tomorrowStart)) {
            hourMap.put(((Number) row.get("hour")).intValue(), ((Number) row.get("count")).longValue());
        }
        List<DashboardChartsVO.HourlyCount> hourlyActivity = hourMap.entrySet().stream()
            .map(e -> new DashboardChartsVO.HourlyCount(e.getKey(), e.getValue())).toList();

        // User growth (monthly student registration)
        List<Map<String, Object>> monthRows = jdbcTemplate.queryForList(
            "SELECT DATE_FORMAT(u.created_at, '%Y-%m') AS month, COUNT(*) AS count FROM users u "
                + "INNER JOIN class_members cm ON cm.user_id = u.id WHERE cm.class_id IN (" + classIdList
                + ") GROUP BY month ORDER BY month");
        long cumulative = 0;
        List<DashboardChartsVO.MonthlyUserCount> userGrowth = new ArrayList<>();
        for (Map<String, Object> row : monthRows) {
            cumulative += ((Number) row.get("count")).longValue();
            userGrowth.add(new DashboardChartsVO.MonthlyUserCount((String) row.get("month"), cumulative));
        }

        // Top problems
        List<DashboardChartsVO.TopProblem> topProblems = jdbcTemplate.queryForList(
            "SELECT p.id AS problem_id, p.title, p.difficulty, COUNT(s.id) AS submissions, "
                + "ROUND(SUM(CASE WHEN s.status = 'AC' THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id), 1) AS ac_rate "
                + "FROM submissions s JOIN problems p ON s.problem_id = p.id "
                + "WHERE s.user_id IN " + studentSub + " AND p.is_deleted = 0 "
                + "GROUP BY p.id, p.title, p.difficulty ORDER BY submissions DESC LIMIT 5")
            .stream().map(row -> new DashboardChartsVO.TopProblem(
                ((Number) row.get("problem_id")).longValue(), (String) row.get("title"),
                ((Number) row.get("difficulty")).intValue(), ((Number) row.get("submissions")).longValue(),
                ((Number) row.get("ac_rate")).doubleValue())).toList();

        // Recent contests (teacher-owned)
        List<AdminDashboardContestVO> recentContests = contestMapper.selectPage(
            Page.of(1, 5),
            new QueryWrapper<Contest>().eq("is_deleted", false)
                .eq("owner_id", teacherId).eq("owner_account_type", "TEACHER")
                .orderByDesc("start_time")
        ).getRecords().stream().map(contest -> {
            String status = "NOT_STARTED";
            if (contest.startTime != null && contest.endTime != null) {
                if (now.isBefore(contest.startTime)) status = "NOT_STARTED";
                else if (now.isAfter(contest.endTime)) status = "ENDED";
                else status = "RUNNING";
            }
            /**
             * 封装管理员仪表盘比赛VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new AdminDashboardContestVO(
                contest.id, contest.title, contest.startTime, contest.endTime,
                contest.type, contest.audience, status);
        }).toList();

        /**
         * 封装管理员仪表盘VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new AdminDashboardVO(
            0, studentCount, problemCount, submissionCount,
            todaySubmissions, todayAccepted, todayActiveUsers, activeContestCount,
            recentContests, totalStats, submissionTrend, verdictDistribution,
            languageUsage, difficultyDistribution, hourlyActivity, userGrowth, topProblems);
    }

    private AdminDashboardVO emptyTeacherDashboard() {
        List<DashboardChartsVO.HourlyCount> emptyHours = new ArrayList<>();
        for (int i = 0; i < 24; i++) emptyHours.add(new DashboardChartsVO.HourlyCount(i, 0));

        List<DashboardChartsVO.DailySubmission> emptyTrend = new ArrayList<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MM-dd");
        LocalDateTime weekAgo = LocalDate.now().minusDays(6).atStartOfDay();
        for (int i = 0; i < 7; i++) {
            emptyTrend.add(new DashboardChartsVO.DailySubmission(weekAgo.plusDays(i).toLocalDate().format(fmt), 0, 0));
        }

        /**
         * 封装管理员仪表盘VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new AdminDashboardVO(0, 0, 0, 0, 0, 0, 0, 0,
            List.of(),
            new DashboardChartsVO.TotalStats(0, Map.of(), 0, Map.of(), 0, 0, 0, Map.of()),
            emptyTrend, List.of(), List.of(), List.of(), emptyHours, List.of(), List.of());
    }
}
