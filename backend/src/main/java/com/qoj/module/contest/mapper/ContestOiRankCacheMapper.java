package com.qoj.module.contest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.contest.entity.ContestOiRankCache;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

/**
 * 比赛Oi排名Cache数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ContestOiRankCacheMapper extends BaseMapper<ContestOiRankCache> {

    @Select("SELECT * FROM contest_oi_rank_cache " +
            "WHERE contest_id = #{contestId} " +
            "ORDER BY total_score DESC, solved_count DESC, last_score_update_time ASC, submission_count ASC, participant_id ASC")
    /**
     * 封装select排名列表相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<ContestOiRankCache> selectRankList(@Param("contestId") Long contestId);
}
