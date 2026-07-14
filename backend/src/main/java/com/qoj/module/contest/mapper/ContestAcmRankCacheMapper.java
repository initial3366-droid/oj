package com.qoj.module.contest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.contest.entity.ContestAcmRankCache;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

/**
 * 比赛Acm排名Cache数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ContestAcmRankCacheMapper extends BaseMapper<ContestAcmRankCache> {

    @Select("SELECT * FROM contest_acm_rank_cache " +
            "WHERE contest_id = #{contestId} " +
            "ORDER BY solved_count DESC, penalty_time ASC, last_ac_time ASC, participant_id ASC")
    /**
     * 封装select排名列表相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<ContestAcmRankCache> selectRankList(@Param("contestId") Long contestId);
}
