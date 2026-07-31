package com.qoj.module.problem.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.problem.entity.ProblemTestCase;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 题目Test测试点数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ProblemTestCaseMapper extends BaseMapper<ProblemTestCase> {
    /**
     * 封装selectBy题目标识相关逻辑。从持久化层读取数据。
     */
    @Select("SELECT * FROM problem_test_cases WHERE problem_id = #{problemId} ORDER BY case_no ASC")
    List<ProblemTestCase> selectByProblemId(@Param("problemId") Long problemId);
}
