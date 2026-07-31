package com.qoj.module.contest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.contest.entity.ContestProblemCaseScore;
import org.apache.ibatis.annotations.Mapper;

/**
 * 比赛题目测试点分数数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ContestProblemCaseScoreMapper extends BaseMapper<ContestProblemCaseScore> {
}
