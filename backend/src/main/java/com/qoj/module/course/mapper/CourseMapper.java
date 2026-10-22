package com.qoj.module.course.mapper;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.course.entity.Course;
import com.qoj.module.course.vo.CoursePracticeVO;
import com.qoj.module.course.vo.CourseReportVO.StudentProgress;
import com.qoj.module.course.vo.CourseVO;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CourseMapper extends BaseMapper<Course> {
    @Select("""
        SELECT c.id, c.title, c.description, c.term, c.owner_account_type, c.owner_id,
          CASE WHEN c.owner_account_type = 'TEACHER' THEN t.display_name ELSE a.display_name END teacher_name,
          c.class_id, cl.name class_name, c.status,
          (SELECT COUNT(*) FROM course_classes cc JOIN class_members cm ON cm.class_id = cc.class_id WHERE cc.course_id = c.id) student_count,
          (SELECT COUNT(*) FROM practice_publications p WHERE p.course_id = c.id AND p.status = 'PUBLISHED') practice_count, c.created_at, c.updated_at
        FROM courses c LEFT JOIN classes cl ON cl.id = c.class_id
        LEFT JOIN teachers t ON c.owner_account_type = 'TEACHER' AND t.id = c.owner_id
        LEFT JOIN admin_users a ON c.owner_account_type = 'ADMIN' AND a.id = c.owner_id
        ${ew.customSqlSegment}
        """)
    List<CourseVO> summaries(@Param("ew") Wrapper<Course> wrapper);

    @Select("""
        SELECT p.id, p.title, p.description, p.display_order,
          COUNT(DISTINCT pp.problem_id) problem_count,
          COUNT(DISTINCT CASE WHEN ups.best_status = 'AC' THEN pp.problem_id END) solved_count,
          (p.password_hash IS NOT NULL AND p.password_hash <> '') has_password, p.start_time, p.end_time
        FROM practice_publications p
        LEFT JOIN practice_publication_problems pp ON pp.publication_id = p.id AND pp.visibility = 'VISIBLE'
        LEFT JOIN user_problem_status ups ON ups.user_id = #{userId} AND ups.problem_id = pp.problem_id
        WHERE p.course_id = #{courseId} AND p.status = 'PUBLISHED'
          AND (p.start_time IS NULL OR p.start_time <= #{now})
          AND (p.end_time IS NULL OR p.end_time > #{now})
        GROUP BY p.id, p.title, p.description, p.display_order, p.password_hash, p.start_time, p.end_time
        ORDER BY p.display_order, p.id
        """)
    List<CoursePracticeVO> studentPractices(@Param("courseId") Long courseId, @Param("userId") Long userId, @Param("now") LocalDateTime now);

    @Select("""
        SELECT u.id user_id, u.display_name, u.student_no,
          COALESCE(activity.submission_count, 0) submission_count,
          COALESCE(progress.solved_count, 0) solved_count,
          COALESCE(progress.completed_practices, 0) completed_practices, cm.class_id, cl.name class_name
        FROM course_classes cc JOIN class_members cm ON cm.class_id = cc.class_id
        JOIN users u ON u.id = cm.user_id JOIN classes cl ON cl.id = cm.class_id
        LEFT JOIN (
          SELECT s.user_id, COUNT(DISTINCT s.id) submission_count
          FROM practice_publications p JOIN submissions s ON s.practice_publication_id = p.id
          WHERE p.course_id = #{courseId} AND p.status = 'PUBLISHED'
          GROUP BY s.user_id
        ) activity ON activity.user_id = u.id
        LEFT JOIN (
          SELECT pub_progress.user_id,
            COALESCE(SUM(pub_progress.solved_count), 0) solved_count,
            COALESCE(SUM(CASE WHEN pub_progress.problem_count > 0 AND pub_progress.solved_count = pub_progress.problem_count THEN 1 ELSE 0 END), 0) completed_practices
          FROM (
            SELECT cm2.user_id user_id, p2.id publication_id,
              (SELECT COUNT(*) FROM practice_publication_problems items WHERE items.publication_id = p2.id AND items.visibility = 'VISIBLE') problem_count,
              COUNT(DISTINCT CASE WHEN ups.best_status = 'AC' THEN items2.problem_id END) solved_count
            FROM practice_publications p2
            JOIN course_classes cc2 ON cc2.course_id = p2.course_id
            JOIN class_members cm2 ON cm2.class_id = cc2.class_id
            LEFT JOIN practice_publication_problems items2 ON items2.publication_id = p2.id AND items2.visibility = 'VISIBLE'
            LEFT JOIN user_problem_status ups ON ups.user_id = cm2.user_id AND ups.problem_id = items2.problem_id
            WHERE p2.course_id = #{courseId} AND p2.status = 'PUBLISHED'
            GROUP BY cm2.user_id, p2.id
          ) pub_progress
          GROUP BY pub_progress.user_id
        ) progress ON progress.user_id = u.id
        WHERE cc.course_id = #{courseId}
        GROUP BY u.id, u.display_name, u.student_no, cm.class_id, cl.name ORDER BY cl.name, u.student_no, u.id
        """)
    List<StudentProgress> studentProgress(@Param("courseId") Long courseId);
}
