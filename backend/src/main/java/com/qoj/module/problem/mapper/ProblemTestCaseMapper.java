package com.qoj.module.problem.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.vo.ProblemTestCaseSummaryVO;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 题目Test测试点数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ProblemTestCaseMapper extends BaseMapper<ProblemTestCase> {
    @Select("SELECT id, case_no, OCTET_LENGTH(input_data) AS input_bytes, "
        + "OCTET_LENGTH(output_data) AS output_bytes, COALESCE(OCTET_LENGTH(public_input), 0) AS public_input_bytes "
        + "FROM problem_test_cases WHERE problem_id = #{problemId} AND sample = 0 ORDER BY case_no")
    List<ProblemTestCaseSummaryVO> selectSummaries(@Param("problemId") long problemId);

    // Match String.isBlank without transferring LONGTEXT data to the application.
    @Select("SELECT EXISTS(SELECT 1 FROM problem_test_cases WHERE problem_id = #{problemId} AND sample = 0 "
        + "AND (output_data IS NULL OR output_data REGEXP #{blankPattern}))")
    boolean hasBlankOutput(@Param("problemId") long problemId, @Param("blankPattern") String blankPattern);

    /**
     * 封装selectBy题目标识相关逻辑。从持久化层读取数据。
     */
    @Select("SELECT * FROM problem_test_cases WHERE problem_id = #{problemId} ORDER BY case_no ASC")
    List<ProblemTestCase> selectByProblemId(@Param("problemId") Long problemId);
}
