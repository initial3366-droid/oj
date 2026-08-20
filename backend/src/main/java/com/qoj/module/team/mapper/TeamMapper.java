package com.qoj.module.team.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.team.entity.Team;
import org.apache.ibatis.annotations.Mapper;

/**
 * 队伍数据访问接口。继承 MyBatis-Plus 基础能力并可按需扩展查询方法。
 */
@Mapper
public interface TeamMapper extends BaseMapper<Team> {
}
