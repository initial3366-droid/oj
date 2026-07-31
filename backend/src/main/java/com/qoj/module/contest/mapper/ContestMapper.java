package com.qoj.module.contest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.contest.entity.Contest;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 比赛数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ContestMapper extends BaseMapper<Contest> {
    /**
     * 封装select比赛CountBy类型相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT type, COUNT(*) AS count FROM contests WHERE is_deleted = 0 GROUP BY type")
    List<java.util.Map<String, Object>> selectContestCountByType();

    /** Serializes judge-mode changes against the first submission snapshot. */
    @Select("SELECT * FROM contests WHERE id = #{id} FOR UPDATE")
    Contest selectByIdForUpdate(@Param("id") long id);
}
