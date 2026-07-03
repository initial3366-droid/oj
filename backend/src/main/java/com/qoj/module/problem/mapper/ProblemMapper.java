package com.qoj.module.problem.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.problem.entity.Problem;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ProblemMapper extends BaseMapper<Problem> {
    @Select("SELECT difficulty, COUNT(*) AS count FROM problems WHERE is_deleted = 0 GROUP BY difficulty ORDER BY difficulty")
    List<java.util.Map<String, Object>> selectDifficultyDistribution();
}
