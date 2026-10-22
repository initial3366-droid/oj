package com.qoj.module.submission.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.submission.entity.Submission;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 提交数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface SubmissionMapper extends BaseMapper<Submission> {
    @Select("<script>SELECT COUNT(DISTINCT user_id) FROM submissions WHERE contest_id = #{contestId}"
        + "<if test='cutoff != null'> AND submit_time &lt;= #{cutoff}</if></script>")
    Long countContestActiveUsers(@Param("contestId") Long contestId, @Param("cutoff") LocalDateTime cutoff);

    /**
     * 计算By题目标识。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT COUNT(*) FROM submissions WHERE problem_id = #{problemId}")
    Long countByProblemId(@Param("problemId") Long problemId);

    /**
     * 计算AcceptedBy题目标识。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT COUNT(*) FROM submissions WHERE problem_id = #{problemId} AND status = 'AC'")
    Long countAcceptedByProblemId(@Param("problemId") Long problemId);

    /**
     * 计算AcceptedProblemsBy用户标识。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT COUNT(DISTINCT problem_id) FROM submissions WHERE user_id = #{userId} AND contest_id IS NULL AND status = 'AC'")
    Long countAcceptedProblemsByUserId(@Param("userId") Long userId);

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

    /** Counts active go-judge executions. */
    @Select("SELECT COUNT(*) FROM submissions WHERE judge_server = 'GO_JUDGE' AND status IN ('JUDGING', 'RUNNING', 'COMPILING')")
    Long countRunning();

    /**
     * 查询等待队列中的提交（按提交时间升序，保证先提交先评测）
     * 包含 WAITING、PENDING、REJUDGE_PENDING 状态
     */
    @Select("""
        SELECT s.* FROM submissions s
        JOIN (SELECT user_id, MIN(id) AS next_id FROM submissions
              WHERE status IN ('WAITING', 'PENDING', 'REJUDGE_PENDING') GROUP BY user_id) pending
          ON pending.next_id = s.id
        WHERE NOT EXISTS (SELECT 1 FROM submissions active WHERE active.user_id = s.user_id
            AND active.status IN ('JUDGING', 'RUNNING', 'COMPILING'))
        ORDER BY s.priority DESC, s.submit_time ASC LIMIT #{limit}
        """)
    List<Submission> selectWaiting(@Param("limit") int limit);

    /**
     * 封装selectBy标识ForUpdate相关逻辑。从持久化层读取数据。
     */
    @Select("SELECT * FROM submissions WHERE id = #{id} FOR UPDATE")
    Submission selectByIdForUpdate(@Param("id") Long id);

    /**
     * 原子更新提交状态：从当前状态更新为新状态，并设置 workerId
     * 使用乐观锁防止多实例重复判题：
     * - 只有当 status = currentStatus 时才更新
     * - judgeWorkerId IS NULL 确保未被其他 worker 抢占
     */
    @Update("UPDATE submissions SET status = #{newStatus}, judge_worker_id = #{workerId}, " +
            "judge_start_time = #{startTime}, judge_server = #{judgeServer}, updated_at = #{startTime} " +
            "WHERE id = #{id} AND status = #{currentStatus} AND judge_worker_id IS NULL")
    /**
     * 封装atomicClaim相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    int atomicClaim(@Param("id") Long id,
                     @Param("currentStatus") String currentStatus,
                     @Param("newStatus") String newStatus,
                     @Param("judgeServer") String judgeServer,
                     @Param("workerId") String workerId,
                     @Param("startTime") LocalDateTime startTime);

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
     * Requeues embedded-judge claims left behind by a crashed backend process.
     * The stale-time predicate prevents an active task from being reclaimed
     * immediately, while clearing the worker ownership lets a new process claim it.
     */
    @Update("""
        UPDATE submissions
        SET status = 'WAITING',
            judge_worker_id = NULL,
            judge_start_time = NULL,
            judge_end_time = NULL,
            judge_server = NULL,
            judge_message = NULL,
            error_message = NULL,
            retry_count = COALESCE(retry_count, 0) + 1,
            updated_at = #{recoveredAt}
        WHERE judge_server = 'GO_JUDGE'
          AND judge_worker_id IS NOT NULL
          AND status IN ('JUDGING', 'COMPILING', 'RUNNING')
          AND COALESCE(retry_count, 0) < 3
          AND COALESCE(updated_at, judge_start_time, submit_time) < #{staleBefore}
        """)
    int requeueStaleGoJudgeClaims(
        @Param("staleBefore") LocalDateTime staleBefore,
        @Param("recoveredAt") LocalDateTime recoveredAt
    );

    @Update("""
        UPDATE submissions SET updated_at = #{now}
        WHERE id = #{id} AND judge_worker_id = #{workerId}
          AND status IN ('JUDGING', 'COMPILING', 'RUNNING')
        """)
    int renewGoJudgeClaim(@Param("id") Long id, @Param("workerId") String workerId,
        @Param("now") LocalDateTime now);

    @Update("""
        UPDATE submissions SET status = 'SE', judge_worker_id = NULL,
            judge_end_time = #{now}, updated_at = #{now},
            error_message = 'Judge worker recovery limit exceeded'
        WHERE judge_server = 'GO_JUDGE' AND judge_worker_id IS NOT NULL
          AND status IN ('JUDGING', 'COMPILING', 'RUNNING')
          AND COALESCE(retry_count, 0) >= 3
          AND COALESCE(updated_at, judge_start_time, submit_time) < #{staleBefore}
        """)
    int failExhaustedGoJudgeClaims(@Param("staleBefore") LocalDateTime staleBefore,
        @Param("now") LocalDateTime now);

    /** Updates completion metadata only while the same embedded worker owns the row. */
    @Update("""
        UPDATE submissions
        SET judge_server = 'GO_JUDGE',
            judge_message = #{judgeMessage},
            error_message = #{errorMessage},
            updated_at = #{updatedAt}
        WHERE id = #{id}
          AND judge_server = 'GO_JUDGE'
          AND judge_worker_id = #{workerId}
        """)
    int updateGoJudgeCompletionMetadata(
        @Param("id") Long id,
        @Param("workerId") String workerId,
        @Param("judgeMessage") String judgeMessage,
        @Param("errorMessage") String errorMessage,
        @Param("updatedAt") LocalDateTime updatedAt
    );

    /** Marks a go-judge execution as failed only while its worker claim is valid. */
    @Update("""
        UPDATE submissions
        SET status = 'SE',
            judge_server = 'GO_JUDGE',
            judge_end_time = #{judgeEndTime},
            judge_message = #{judgeMessage},
            error_message = #{errorMessage},
            updated_at = #{updatedAt}
        WHERE id = #{id}
          AND judge_server = 'GO_JUDGE'
          AND judge_worker_id = #{workerId}
        """)
    int markGoJudgeFailure(
        @Param("id") Long id,
        @Param("workerId") String workerId,
        @Param("judgeEndTime") LocalDateTime judgeEndTime,
        @Param("judgeMessage") String judgeMessage,
        @Param("errorMessage") String errorMessage,
        @Param("updatedAt") LocalDateTime updatedAt
    );

    /**
     * 按状态和 workerId 查询任务（用于恢复启动时检查当前 worker 处理的任务）
     */
    @Select("SELECT * FROM submissions WHERE judge_worker_id = #{workerId} AND status IN ('JUDGING', 'RUNNING', 'COMPILING')")
    List<Submission> selectByWorker(@Param("workerId") String workerId);

    /**
     * 清除指定提交的 workerId（判题完成后释放）
     */
    @Update("""
        UPDATE submissions
        SET judge_worker_id = NULL, updated_at = #{releasedAt}
        WHERE id = #{id} AND judge_worker_id = #{workerId}
        """)
    int releaseWorker(
        @Param("id") Long id,
        @Param("workerId") String workerId,
        @Param("releasedAt") LocalDateTime releasedAt
    );

    // ── Dashboard aggregation queries ──

    @Select("""
        SELECT DATE(COALESCE(submit_time, created_at)) AS date, COUNT(*) AS total,
               SUM(CASE WHEN status IN ('AC', 'ACCEPTED') THEN 1 ELSE 0 END) AS accepted
        FROM submissions WHERE COALESCE(submit_time, created_at) >= #{startDate}
        GROUP BY DATE(COALESCE(submit_time, created_at)) ORDER BY date
        """)
    /**
     * 封装selectDailySubmissions相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<Map<String, Object>> selectDailySubmissions(@Param("startDate") LocalDateTime startDate);

    @Select("SELECT status, COUNT(*) AS count FROM submissions " +
            "WHERE status IS NOT NULL GROUP BY status")
    /**
     * 封装selectVerdictDistribution相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<Map<String, Object>> selectVerdictDistribution();

    @Select("SELECT language, COUNT(*) AS count FROM submissions " +
            "WHERE language IS NOT NULL GROUP BY language ORDER BY count DESC")
    /**
     * 封装selectLanguageUsage相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<Map<String, Object>> selectLanguageUsage();

    @Select("SELECT HOUR(created_at) AS hour, COUNT(*) AS count " +
            "FROM submissions WHERE created_at >= #{todayStart} AND created_at < #{tomorrowStart} " +
            "GROUP BY HOUR(created_at) ORDER BY hour")
    /**
     * 封装selectHourlyActivity相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<Map<String, Object>> selectHourlyActivity(@Param("todayStart") LocalDateTime todayStart,
                                                              @Param("tomorrowStart") LocalDateTime tomorrowStart);

    @Select("SELECT p.id AS problem_id, p.title, p.difficulty, COUNT(s.id) AS submissions, " +
            "ROUND(SUM(CASE WHEN s.status = 'AC' THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id), 1) AS ac_rate " +
            "FROM submissions s JOIN problems p ON s.problem_id = p.id " +
            "WHERE p.is_deleted = 0 GROUP BY p.id, p.title, p.difficulty ORDER BY submissions DESC LIMIT 5")
    /**
     * 封装selectTopProblems相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<Map<String, Object>> selectTopProblems();

    /**
     * 计算Today有效Users。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT COUNT(DISTINCT user_id) FROM submissions WHERE created_at >= #{todayStart} AND created_at < #{tomorrowStart}")
    Long countTodayActiveUsers(@Param("todayStart") LocalDateTime todayStart, @Param("tomorrowStart") LocalDateTime tomorrowStart);
}
