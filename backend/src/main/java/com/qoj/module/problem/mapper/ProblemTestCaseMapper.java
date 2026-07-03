package com.qoj.module.problem.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.problem.entity.ProblemTestCase;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ProblemTestCaseMapper extends BaseMapper<ProblemTestCase> {
    @Select("SELECT * FROM problem_test_cases WHERE problem_id = #{problemId} ORDER BY case_no ASC")
    List<ProblemTestCase> selectByProblemId(@Param("problemId") Long problemId);
}
