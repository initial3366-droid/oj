package com.qoj.module.problem.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.problem.entity.Problem;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 题目数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ProblemMapper extends BaseMapper<Problem> {
    /**
     * 封装selectDifficultyDistribution相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT difficulty, COUNT(*) AS count FROM problems WHERE is_deleted = 0 GROUP BY difficulty ORDER BY difficulty")
    List<java.util.Map<String, Object>> selectDifficultyDistribution();
}
