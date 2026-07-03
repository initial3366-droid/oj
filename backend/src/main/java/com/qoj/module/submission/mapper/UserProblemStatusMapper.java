package com.qoj.module.submission.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.submission.entity.UserProblemStatus;
import java.time.LocalDateTime;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface UserProblemStatusMapper extends BaseMapper<UserProblemStatus> {

    @Insert("""
        INSERT INTO user_problem_status (
            user_id,
            problem_id,
            best_status,
            last_status,
            last_submission_id,
            submit_count,
            accepted_at,
            last_submitted_at
        )
        VALUES (
            #{userId},
            #{problemId},
            #{status},
            #{status},
            #{submissionId},
            #{increment},
            #{acceptedAt},
            #{submittedAt}
        )
        ON DUPLICATE KEY UPDATE
            best_status = CASE
                WHEN best_status = 'AC' THEN 'AC'
                WHEN VALUES(best_status) = 'AC' THEN 'AC'
                ELSE VALUES(best_status)
            END,
            last_status = VALUES(last_status),
            last_submission_id = VALUES(last_submission_id),
            submit_count = submit_count + #{increment},
            accepted_at = CASE
                WHEN accepted_at IS NOT NULL THEN accepted_at
                WHEN VALUES(best_status) = 'AC' THEN VALUES(accepted_at)
                ELSE accepted_at
            END,
            last_submitted_at = VALUES(last_submitted_at)
        """)
    void upsertStatus(
        @Param("userId") Long userId,
        @Param("problemId") Long problemId,
        @Param("status") String status,
        @Param("submissionId") Long submissionId,
        @Param("increment") int increment,
        @Param("acceptedAt") LocalDateTime acceptedAt,
        @Param("submittedAt") LocalDateTime submittedAt
    );

    @Insert("""
        INSERT INTO user_problem_status (
            user_id,
            problem_id,
            best_status,
            last_status,
            last_submission_id,
            submit_count,
            accepted_at,
            last_submitted_at
        )
        VALUES (
            #{userId},
            #{problemId},
            #{bestStatus},
            #{lastStatus},
            #{lastSubmissionId},
            #{submitCount},
            #{acceptedAt},
            #{lastSubmittedAt}
        )
        ON DUPLICATE KEY UPDATE
            best_status = #{bestStatus},
            last_status = #{lastStatus},
            last_submission_id = #{lastSubmissionId},
            submit_count = #{submitCount},
            accepted_at = #{acceptedAt},
            last_submitted_at = #{lastSubmittedAt}
        """)
    void replaceComputedStatus(
        @Param("userId") Long userId,
        @Param("problemId") Long problemId,
        @Param("bestStatus") String bestStatus,
        @Param("lastStatus") String lastStatus,
        @Param("lastSubmissionId") Long lastSubmissionId,
        @Param("submitCount") int submitCount,
        @Param("acceptedAt") LocalDateTime acceptedAt,
        @Param("lastSubmittedAt") LocalDateTime lastSubmittedAt
    );

    @Update("UPDATE user_problem_status SET last_submission_id = NULL WHERE last_submission_id = #{submissionId}")
    void clearLastSubmission(@Param("submissionId") Long submissionId);
}
