package com.qoj.module.submission.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.submission.entity.SubmissionCaseResult;
import org.apache.ibatis.annotations.Mapper;

/**
 * 提交测试点结果数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface SubmissionCaseResultMapper extends BaseMapper<SubmissionCaseResult> {
}
