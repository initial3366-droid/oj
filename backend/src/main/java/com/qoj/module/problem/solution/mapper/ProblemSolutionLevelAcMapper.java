package com.qoj.module.problem.solution.mapper;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ProblemSolutionLevelAcMapper {
    @Insert("INSERT IGNORE INTO problem_solution_level_ac (problem_id, account_type, user_id, level_no) VALUES (#{problemId}, #{accountType}, #{userId}, #{level})")
    int insertIfMissing(
        @Param("problemId") long problemId,
        @Param("accountType") String accountType,
        @Param("userId") long userId,
        @Param("level") int level
    );

    @Select("SELECT COUNT(*) FROM problem_solution_level_ac WHERE problem_id = #{problemId} AND level_no = #{level} AND account_type = 'USER'")
    long countAcceptedAtLevel(@Param("problemId") long problemId, @Param("level") int level);

    @Select("SELECT level_no FROM problem_solution_level_ac WHERE problem_id = #{problemId} AND account_type = #{accountType} AND user_id = #{userId}")
    Integer acceptedLevel(
        @Param("problemId") long problemId,
        @Param("accountType") String accountType,
        @Param("userId") long userId
    );

    @Delete("DELETE FROM problem_solution_level_ac WHERE problem_id = #{problemId}")
    int deleteByProblemId(@Param("problemId") long problemId);
}
