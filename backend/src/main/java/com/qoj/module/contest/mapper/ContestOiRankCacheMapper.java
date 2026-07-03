package com.qoj.module.contest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.contest.entity.ContestOiRankCache;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ContestOiRankCacheMapper extends BaseMapper<ContestOiRankCache> {

    @Select("SELECT * FROM contest_oi_rank_cache " +
            "WHERE contest_id = #{contestId} " +
            "ORDER BY total_score DESC, solved_count DESC, last_score_update_time ASC, submission_count ASC, participant_id ASC")
    List<ContestOiRankCache> selectRankList(@Param("contestId") Long contestId);
}
