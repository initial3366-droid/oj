package com.qoj.module.contest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.contest.entity.ContestAudience;
import org.apache.ibatis.annotations.Mapper;

/**
 * 比赛Audience数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ContestAudienceMapper extends BaseMapper<ContestAudience> {
}
