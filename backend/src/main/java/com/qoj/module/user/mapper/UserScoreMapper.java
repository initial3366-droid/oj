package com.qoj.module.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.user.entity.UserScore;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 用户分数数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface UserScoreMapper extends BaseMapper<UserScore> {

    @Select("""
        SELECT us.user_id, us.total_score, us.rating, us.ac_count, us.submit_count, us.streak, us.updated_at
        FROM user_scores us
        JOIN users u ON u.id = us.user_id
        WHERE u.role = 'STUDENT'
        ORDER BY us.ac_count DESC, us.submit_count ASC, us.user_id ASC
        LIMIT #{limit}
        """)
    List<UserScore> selectTopByAcCount(int limit);

    @Select("""
        SELECT
            u.id AS user_id,
            COALESCE(ac.ac_count, 0) * 100 AS total_score,
            0 AS rating,
            COALESCE(ac.ac_count, 0) AS ac_count,
            COALESCE(sc.submit_count, 0) AS submit_count,
            COALESCE(us.streak, 0) AS streak,
            COALESCE(us.updated_at, u.updated_at) AS updated_at
        FROM users u
        LEFT JOIN user_scores us ON us.user_id = u.id
        LEFT JOIN (
            SELECT user_id, COUNT(*) AS submit_count
            FROM submissions
            WHERE contest_id IS NULL
            GROUP BY user_id
        ) sc ON sc.user_id = u.id
        LEFT JOIN (
            SELECT user_id, COUNT(DISTINCT problem_id) AS ac_count
            FROM submissions
            WHERE contest_id IS NULL
              /**
               * 封装IN相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
               */
              AND status IN ('AC', 'ACCEPTED')
            GROUP BY user_id
        ) ac ON ac.user_id = u.id
        WHERE u.role = 'STUDENT'
          AND (
              COALESCE(sc.submit_count, 0) > 0
              OR COALESCE(ac.ac_count, 0) > 0
          )
        ORDER BY ac_count DESC, submit_count ASC, u.id ASC
        LIMIT #{limit}
        """)
    List<UserScore> selectTopBySubmissionStats(int limit);

    @Select("""
        SELECT COUNT(*) + 1
        FROM user_scores us
        JOIN users u ON u.id = us.user_id
        WHERE u.role = 'STUDENT'
          AND (
              us.ac_count > #{acCount}
              OR (us.ac_count = #{acCount} AND us.submit_count < #{submitCount})
              OR (us.ac_count = #{acCount} AND us.submit_count = #{submitCount} AND us.user_id < #{userId})
          )
        """)
    Long selectRankByScore(
        @Param("acCount") int acCount,
        @Param("submitCount") int submitCount,
        @Param("userId") long userId
    );

        /**
         * 计算统计结果。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
    @Select("""
        SELECT COUNT(DISTINCT problem_id)
        FROM submissions
        WHERE user_id = #{userId}
          AND contest_id IS NULL
          AND status IN ('AC', 'ACCEPTED')
          AND COALESCE(submit_time, created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL WEEKDAY(CURRENT_DATE()) DAY)
        """)
    Integer selectWeekAcCount(@Param("userId") long userId);
}
