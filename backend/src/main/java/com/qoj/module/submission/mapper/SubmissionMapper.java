package com.qoj.module.submission.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.submission.entity.Submission;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 提交数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface SubmissionMapper extends BaseMapper<Submission> {
    /**
     * 计算By题目标识。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT COUNT(*) FROM submissions WHERE problem_id = #{problemId} AND contest_id IS NULL")
    Long countByProblemId(@Param("problemId") Long problemId);

    /**
     * 计算AcceptedBy题目标识。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT COUNT(*) FROM submissions WHERE problem_id = #{problemId} AND contest_id IS NULL AND status = 'AC'")
    Long countAcceptedByProblemId(@Param("problemId") Long problemId);

    /**
     * 计算AcceptedProblemsBy用户标识。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT COUNT(DISTINCT problem_id) FROM submissions WHERE user_id = #{userId} AND contest_id IS NULL AND status = 'AC'")
    Long countAcceptedProblemsByUserId(@Param("userId") Long userId);

    @Select("""
        <script>
        SELECT COUNT(*)
        FROM (
            SELECT user_id, problem_id
            FROM submissions
            WHERE user_id IN
            <foreach collection="userIds" item="userId" open="(" separator="," close=")">
                #{userId}
            </foreach>
              AND status IN ('AC', 'ACCEPTED')
            GROUP BY user_id, problem_id
        ) accepted_problems
        </script>
        """)
    Integer countAcceptedProblemsByUserIds(@Param("userIds") List<Long> userIds);

        /**
         * 封装DATE相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
    @Select("""
        SELECT DISTINCT DATE(first_ac_time)
        FROM (
            SELECT problem_id, MIN(COALESCE(submit_time, created_at)) AS first_ac_time
            FROM submissions
            WHERE user_id = #{userId}
              AND status IN ('AC', 'ACCEPTED')
            GROUP BY problem_id
        ) first_ac
        ORDER BY DATE(first_ac_time) DESC
        """)
    List<LocalDate> selectFirstAcceptedProblemDatesByUserId(@Param("userId") Long userId);

    /**
     * 按状态统计提交数量
     */
    @Select("SELECT COUNT(*) FROM submissions WHERE status = #{status}")
    Long countByStatus(@Param("status") String status);

    /** Counts only go-judge work so CCPCOJ workers do not consume embedded slots. */
    @Select("SELECT COUNT(*) FROM submissions WHERE judge_backend = 'GO_JUDGE' AND status IN ('JUDGING', 'RUNNING', 'COMPILING')")
    Long countRunning();

    /**
     * 查询等待队列中的提交（按提交时间升序，保证先提交先评测）
     * 包含 WAITING、PENDING、REJUDGE_PENDING 状态
     */
    @Select("SELECT * FROM submissions WHERE status IN ('WAITING', 'PENDING', 'REJUDGE_PENDING') ORDER BY priority DESC, submit_time ASC LIMIT #{limit}")
    List<Submission> selectWaiting(@Param("limit") int limit);

    /**
     * Selects only the submission scopes handled by an embedded judge backend.
     * CCPCOJ-owned scopes are deliberately excluded by the scheduler before this query.
     */
    @Select("""
        SELECT * FROM submissions
        /**
         * 封装IN相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        WHERE status IN ('WAITING', 'PENDING', 'REJUDGE_PENDING')
          AND judge_backend = 'GO_JUDGE'
        ORDER BY priority DESC, submit_time ASC
        LIMIT #{limit}
        """)
    List<Submission> selectWaitingForEmbeddedJudge(@Param("limit") int limit);

    /**
     * Returns tasks compatible with the legacy CCPCOJ pull protocol. All values are
     * bound parameters; no worker-controlled value is interpolated into SQL text.
     */
    @Select("""
        SELECT s.* FROM submissions s
        LEFT JOIN contests c ON c.id = s.contest_id
        WHERE (
            s.status IN ('WAITING', 'PENDING', 'REJUDGE_PENDING')
            OR (
                s.judge_server = 'CCPCOJ'
                AND s.status IN ('JUDGING', 'COMPILING', 'RUNNING')
                AND s.judge_start_time < #{staleBefore}
            )
        )
          AND s.judge_backend = 'CCPCOJ'
          AND s.id BETWEEN 1 AND 2147483647
          AND s.user_id BETWEEN 0 AND 2147483647
          AND s.problem_id BETWEEN 1 AND 1073741823
          AND (s.contest_problem_id IS NULL OR s.contest_problem_id BETWEEN 1 AND 1073741823)
          AND (s.contest_id IS NULL OR s.contest_id BETWEEN 1 AND 2147483647)
          AND s.contest_id IS NOT NULL
          AND (
              (#{oiWorker} = TRUE AND UPPER(COALESCE(c.scoring_mode, c.type, 'ACM')) = 'OI')
              OR (#{oiWorker} = FALSE AND UPPER(COALESCE(c.scoring_mode, c.type, 'ACM')) <> 'OI')
          )
          AND (
            (#{acceptC} = TRUE AND LOWER(TRIM(s.language)) = 'c')
            OR (#{acceptCpp} = TRUE AND LOWER(TRIM(s.language)) IN ('cpp', 'c++', 'cxx', 'g++'))
            OR (#{acceptJava} = TRUE AND LOWER(TRIM(s.language)) = 'java')
            OR (#{acceptPython} = TRUE AND LOWER(TRIM(s.language)) IN ('python', 'python3', 'py'))
          )
        ORDER BY s.priority DESC, s.submit_time ASC
        LIMIT #{limit}
        """)
    /**
     * 封装selectWaitingForCcpcoj相关逻辑。可能调用外部判题或网关服务。
     */
    List<Submission> selectWaitingForCcpcoj(
        @Param("limit") int limit,
        @Param("oiWorker") boolean oiWorker,
        @Param("acceptC") boolean acceptC,
        @Param("acceptCpp") boolean acceptCpp,
        @Param("acceptJava") boolean acceptJava,
        @Param("acceptPython") boolean acceptPython,
        @Param("staleBefore") LocalDateTime staleBefore
    );

    /**
     * 封装selectBy标识ForUpdate相关逻辑。从持久化层读取数据。
     */
    @Select("SELECT * FROM submissions WHERE id = #{id} FOR UPDATE")
    Submission selectByIdForUpdate(@Param("id") Long id);

    /**
     * Atomically claims either a new task or a stale CCPCOJ task. The worker id is
     * later checked before any source code or result mutation is allowed.
     */
    @Update("""
        UPDATE submissions s
        LEFT JOIN contests c ON c.id = s.contest_id
        SET s.status = 'COMPILING',
            s.judge_worker_id = #{workerId},
            s.judge_server = 'CCPCOJ',
            s.judge_start_time = #{startTime},
            s.judge_end_time = NULL,
            s.error_message = NULL,
            s.updated_at = #{startTime}
        WHERE s.id = #{id}
          AND (
              s.status IN ('WAITING', 'PENDING', 'REJUDGE_PENDING')
              OR (
                  s.judge_server = 'CCPCOJ'
                  AND s.status IN ('JUDGING', 'COMPILING', 'RUNNING')
                  AND s.judge_start_time < #{staleBefore}
              )
          )
          AND s.judge_backend = 'CCPCOJ'
          AND s.contest_id IS NOT NULL
          AND (
              (#{oiWorker} = TRUE AND UPPER(COALESCE(c.scoring_mode, c.type, 'ACM')) = 'OI')
              OR (#{oiWorker} = FALSE AND UPPER(COALESCE(c.scoring_mode, c.type, 'ACM')) <> 'OI')
          )
          AND LOWER(TRIM(s.language)) IN ('c', 'cpp', 'c++', 'cxx', 'g++', 'java', 'python', 'python3', 'py')
        """)
    int claimForCcpcoj(
        @Param("id") Long id,
        @Param("workerId") String workerId,
        @Param("startTime") LocalDateTime startTime,
        @Param("staleBefore") LocalDateTime staleBefore,
        @Param("oiWorker") boolean oiWorker
    );

    /**
     * Authorizes hidden problem data only while this worker owns an active claim.
     */
    @Select("""
        <script>
        SELECT COUNT(*) FROM submissions
        WHERE judge_server = 'CCPCOJ'
          AND judge_backend = 'CCPCOJ'
          AND judge_worker_id = #{workerId}
          AND status IN ('JUDGING', 'COMPILING', 'RUNNING')
          <choose>
            <when test="contestProblem">
              AND contest_problem_id = #{sourceId}
            </when>
            <otherwise>
              AND contest_problem_id IS NULL
              AND problem_id = #{sourceId}
            </otherwise>
          </choose>
        </script>
        """)
    /**
     * 计算有效CcpcojClaims。可能调用外部判题或网关服务。
     */
    long countActiveCcpcojClaims(
        @Param("workerId") String workerId,
        @Param("sourceId") long sourceId,
        @Param("contestProblem") boolean contestProblem
    );

    /**
     * 原子更新提交状态：从当前状态更新为新状态，并设置 workerId
     * 使用乐观锁防止多实例重复判题：
     * - 只有当 status = currentStatus 时才更新
     * - judgeWorkerId IS NULL 确保未被其他 worker 抢占
     */
    @Update("UPDATE submissions SET status = #{newStatus}, judge_worker_id = #{workerId}, " +
            "judge_start_time = #{startTime}, judge_server = #{judgeServer}, updated_at = #{startTime} " +
            "WHERE id = #{id} AND status = #{currentStatus} AND judge_backend = 'GO_JUDGE' " +
            "AND judge_worker_id IS NULL")
    /**
     * 封装atomicClaim相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    int atomicClaim(@Param("id") Long id,
                     @Param("currentStatus") String currentStatus,
                     @Param("newStatus") String newStatus,
                     @Param("judgeServer") String judgeServer,
                     @Param("workerId") String workerId,
                     @Param("startTime") java.time.LocalDateTime startTime);

    /**
     * Returns an embedded-judge claim to the queue when dispatch is rejected.
     * Worker ownership in the predicate prevents an older process from undoing
     * a task that has already been reclaimed elsewhere.
     */
    @Update("""
        UPDATE submissions
        SET status = #{restoredStatus},
            judge_worker_id = NULL,
            judge_start_time = NULL,
            judge_end_time = NULL,
            judge_server = NULL,
            updated_at = #{restoredAt}
        WHERE id = #{id}
          AND status = 'JUDGING'
          AND judge_backend = 'GO_JUDGE'
          AND judge_server = 'GO_JUDGE'
          AND judge_worker_id = #{workerId}
        """)
    /**
     * 封装restoreRejectedEmbeddedClaim相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    int restoreRejectedEmbeddedClaim(
        @Param("id") Long id,
        @Param("workerId") String workerId,
        @Param("restoredStatus") String restoredStatus,
        @Param("restoredAt") LocalDateTime restoredAt
    );

    /**
     * 按状态和 workerId 查询任务（用于恢复启动时检查当前 worker 处理的任务）
     */
    @Select("SELECT * FROM submissions WHERE judge_worker_id = #{workerId} AND status IN ('JUDGING', 'RUNNING', 'COMPILING')")
    List<Submission> selectByWorker(@Param("workerId") String workerId);

    /**
     * 清除指定提交的 workerId（判题完成后释放）
     */
    @Update("UPDATE submissions SET judge_worker_id = NULL, updated_at = #{releasedAt} WHERE id = #{id}")
    int releaseWorker(@Param("id") Long id, @Param("releasedAt") java.time.LocalDateTime releasedAt);

    // ── Dashboard aggregation queries ──

    @Select("SELECT DATE(created_at) AS date, COUNT(*) AS total, " +
            "SUM(CASE WHEN status = 'AC' THEN 1 ELSE 0 END) AS accepted " +
            "FROM submissions WHERE created_at >= #{startDate} " +
            "GROUP BY DATE(created_at) ORDER BY date")
    /**
     * 封装selectDailySubmissions相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<java.util.Map<String, Object>> selectDailySubmissions(@Param("startDate") LocalDateTime startDate);

    @Select("SELECT status, COUNT(*) AS count FROM submissions " +
            "WHERE status IS NOT NULL GROUP BY status")
    /**
     * 封装selectVerdictDistribution相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<java.util.Map<String, Object>> selectVerdictDistribution();

    @Select("SELECT language, COUNT(*) AS count FROM submissions " +
            "WHERE language IS NOT NULL GROUP BY language ORDER BY count DESC")
    /**
     * 封装selectLanguageUsage相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<java.util.Map<String, Object>> selectLanguageUsage();

    @Select("SELECT HOUR(created_at) AS hour, COUNT(*) AS count " +
            "FROM submissions WHERE created_at >= #{todayStart} AND created_at < #{tomorrowStart} " +
            "GROUP BY HOUR(created_at) ORDER BY hour")
    /**
     * 封装selectHourlyActivity相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<java.util.Map<String, Object>> selectHourlyActivity(@Param("todayStart") LocalDateTime todayStart,
                                                              @Param("tomorrowStart") LocalDateTime tomorrowStart);

    @Select("SELECT p.id AS problem_id, p.title, p.difficulty, COUNT(s.id) AS submissions, " +
            "ROUND(SUM(CASE WHEN s.status = 'AC' THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id), 1) AS ac_rate " +
            "FROM submissions s JOIN problems p ON s.problem_id = p.id " +
            "WHERE p.is_deleted = 0 GROUP BY p.id, p.title, p.difficulty ORDER BY submissions DESC LIMIT 5")
    /**
     * 封装selectTopProblems相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<java.util.Map<String, Object>> selectTopProblems();

    /**
     * 计算Today有效Users。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT COUNT(DISTINCT user_id) FROM submissions WHERE created_at >= #{todayStart} AND created_at < #{tomorrowStart}")
    Long countTodayActiveUsers(@Param("todayStart") LocalDateTime todayStart, @Param("tomorrowStart") LocalDateTime tomorrowStart);
}
