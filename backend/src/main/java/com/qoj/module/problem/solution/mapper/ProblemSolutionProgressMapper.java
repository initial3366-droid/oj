package com.qoj.module.problem.solution.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.problem.solution.entity.ProblemSolutionProgress;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ProblemSolutionProgressMapper extends BaseMapper<ProblemSolutionProgress> {
    @Insert("INSERT IGNORE INTO problem_solution_progress (problem_id, account_type, user_id, completed_level) VALUES (#{problemId}, #{accountType}, #{userId}, 0)")
    int insertIfMissing(@Param("problemId") long problemId, @Param("accountType") String accountType, @Param("userId") long userId);

    @Update("UPDATE problem_solution_progress SET viewed_level = GREATEST(viewed_level, LEAST(current_level + 1, #{height})), current_level = LEAST(current_level + 1, #{height}) WHERE problem_id = #{problemId} AND account_type = #{accountType} AND user_id = #{userId} AND current_level < #{height}")
    int advanceCurrentLevel(@Param("problemId") long problemId, @Param("accountType") String accountType, @Param("userId") long userId, @Param("height") int height);

    @Update("UPDATE problem_solution_progress SET current_level = #{level} WHERE problem_id = #{problemId} AND account_type = #{accountType} AND user_id = #{userId} AND viewed_level >= #{level}")
    int selectViewedLevel(@Param("problemId") long problemId, @Param("accountType") String accountType, @Param("userId") long userId, @Param("level") int level);

    @Update("UPDATE problem_solution_progress SET completed_level = #{level}, viewed_level = GREATEST(viewed_level, #{height}) WHERE problem_id = #{problemId} AND account_type = #{accountType} AND user_id = #{userId}")
    int markAccepted(@Param("problemId") long problemId, @Param("accountType") String accountType, @Param("userId") long userId, @Param("level") int level, @Param("height") int height);
}
