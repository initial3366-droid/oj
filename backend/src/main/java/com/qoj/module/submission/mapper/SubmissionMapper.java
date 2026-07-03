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

@Mapper
public interface SubmissionMapper extends BaseMapper<Submission> {
    @Select("SELECT COUNT(*) FROM submissions WHERE problem_id = #{problemId} AND contest_id IS NULL")
    Long countByProblemId(@Param("problemId") Long problemId);

    @Select("SELECT COUNT(*) FROM submissions WHERE problem_id = #{problemId} AND contest_id IS NULL AND status = 'AC'")
    Long countAcceptedByProblemId(@Param("problemId") Long problemId);

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

    /**
     * 统计当前正在运行的判题任务数（JUDGING 或 RUNNING 或 COMPILING）
     */
    @Select("SELECT COUNT(*) FROM submissions WHERE status IN ('JUDGING', 'RUNNING', 'COMPILING')")
    Long countRunning();

    /**
     * 查询等待队列中的提交（按提交时间升序，保证先提交先评测）
     * 包含 WAITING、PENDING、REJUDGE_PENDING 状态
     */
    @Select("SELECT * FROM submissions WHERE status IN ('WAITING', 'PENDING', 'REJUDGE_PENDING') ORDER BY priority DESC, submit_time ASC LIMIT #{limit}")
    List<Submission> selectWaiting(@Param("limit") int limit);

    /**
     * 原子更新提交状态：从当前状态更新为新状态，并设置 workerId
     * 使用乐观锁防止多实例重复判题：
     * - 只有当 status = currentStatus 时才更新
     * - judgeWorkerId IS NULL 确保未被其他 worker 抢占
     */
    @Update("UPDATE submissions SET status = #{newStatus}, judge_worker_id = #{workerId}, " +
            "judge_start_time = #{startTime}, judge_server = #{judgeServer}, updated_at = #{startTime} " +
            "WHERE id = #{id} AND status = #{currentStatus} AND judge_worker_id IS NULL")
    int atomicClaim(@Param("id") Long id,
                     @Param("currentStatus") String currentStatus,
                     @Param("newStatus") String newStatus,
                     @Param("judgeServer") String judgeServer,
                     @Param("workerId") String workerId,
                     @Param("startTime") java.time.LocalDateTime startTime);

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
    List<java.util.Map<String, Object>> selectDailySubmissions(@Param("startDate") LocalDateTime startDate);

    @Select("SELECT status, COUNT(*) AS count FROM submissions " +
            "WHERE status IS NOT NULL GROUP BY status")
    List<java.util.Map<String, Object>> selectVerdictDistribution();

    @Select("SELECT language, COUNT(*) AS count FROM submissions " +
            "WHERE language IS NOT NULL GROUP BY language ORDER BY count DESC")
    List<java.util.Map<String, Object>> selectLanguageUsage();

    @Select("SELECT HOUR(created_at) AS hour, COUNT(*) AS count " +
            "FROM submissions WHERE created_at >= #{todayStart} AND created_at < #{tomorrowStart} " +
            "GROUP BY HOUR(created_at) ORDER BY hour")
    List<java.util.Map<String, Object>> selectHourlyActivity(@Param("todayStart") LocalDateTime todayStart,
                                                              @Param("tomorrowStart") LocalDateTime tomorrowStart);

    @Select("SELECT p.id AS problem_id, p.title, p.difficulty, COUNT(s.id) AS submissions, " +
            "ROUND(SUM(CASE WHEN s.status = 'AC' THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id), 1) AS ac_rate " +
            "FROM submissions s JOIN problems p ON s.problem_id = p.id " +
            "WHERE p.is_deleted = 0 GROUP BY p.id, p.title, p.difficulty ORDER BY submissions DESC LIMIT 5")
    List<java.util.Map<String, Object>> selectTopProblems();

    @Select("SELECT COUNT(DISTINCT user_id) FROM submissions WHERE created_at >= #{todayStart} AND created_at < #{tomorrowStart}")
    Long countTodayActiveUsers(@Param("todayStart") LocalDateTime todayStart, @Param("tomorrowStart") LocalDateTime tomorrowStart);
}
