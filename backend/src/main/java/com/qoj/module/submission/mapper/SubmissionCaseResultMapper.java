package com.qoj.module.submission.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.submission.entity.SubmissionCaseResult;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 提交测试点结果数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface SubmissionCaseResultMapper extends BaseMapper<SubmissionCaseResult> {
    @Select("""
        <script>
        SELECT submission_id, COUNT(*) AS total_case_count,
               SUM(CASE WHEN status = 'AC' THEN 1 ELSE 0 END) AS passed_case_count,
               MAX(CASE WHEN time_used &gt; 0 THEN time_used END) AS max_time_used,
               MAX(CASE WHEN memory_used &gt; 0 THEN memory_used END) AS max_memory_used
        FROM submission_case_results
        WHERE submission_id IN
        <foreach collection="submissionIds" item="id" open="(" separator="," close=")">
            #{id}
        </foreach>
        GROUP BY submission_id
        </script>
        """)
    List<SubmissionCaseSummary> summarizeBySubmissionIds(@Param("submissionIds") List<Long> submissionIds);
}
