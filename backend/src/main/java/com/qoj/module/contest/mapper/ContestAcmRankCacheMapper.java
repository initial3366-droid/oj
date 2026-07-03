package com.qoj.module.contest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.contest.entity.ContestAcmRankCache;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ContestAcmRankCacheMapper extends BaseMapper<ContestAcmRankCache> {

    @Select("SELECT * FROM contest_acm_rank_cache " +
            "WHERE contest_id = #{contestId} " +
            "ORDER BY solved_count DESC, penalty_time ASC, last_ac_time ASC, participant_id ASC")
    List<ContestAcmRankCache> selectRankList(@Param("contestId") Long contestId);
}
