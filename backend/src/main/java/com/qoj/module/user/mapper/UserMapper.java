package com.qoj.module.user.mapper;

import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Param;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.user.entity.User;

/**
 * 用户数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface UserMapper extends BaseMapper<User> {
    record LastSubmission(Long userId, LocalDateTime lastSubmissionTime) {}

    @Select("""
        <script>
        SELECT user_id, MAX(COALESCE(submit_time, created_at)) AS last_submission_time
        FROM submissions
        WHERE user_id IN
        <foreach collection="userIds" item="userId" open="(" separator="," close=")">#{userId}</foreach>
        GROUP BY user_id
        </script>
        """)
    List<LastSubmission> selectLastSubmissionTimes(@Param("userIds") List<Long> userIds);

    default Map<Long, LocalDateTime> lastSubmissionTimes(List<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return selectLastSubmissionTimes(userIds).stream()
            .filter(row -> row.lastSubmissionTime() != null)
            .collect(Collectors.toMap(LastSubmission::userId, LastSubmission::lastSubmissionTime));
    }

    /**
     * 封装select用户CountBy角色相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT role, COUNT(*) AS count FROM users GROUP BY role")
    List<Map<String, Object>> selectUserCountByRole();

    @Select("SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count " +
            "FROM users GROUP BY month ORDER BY month")
    /**
     * 封装selectMonthlyRegistrations相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<Map<String, Object>> selectMonthlyRegistrations();
}
