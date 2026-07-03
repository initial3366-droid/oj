package com.qoj.module.contest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.contest.entity.Contest;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ContestMapper extends BaseMapper<Contest> {
    @Select("SELECT type, COUNT(*) AS count FROM contests WHERE is_deleted = 0 GROUP BY type")
    List<java.util.Map<String, Object>> selectContestCountByType();
}
