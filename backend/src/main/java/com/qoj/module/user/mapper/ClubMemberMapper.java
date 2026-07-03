package com.qoj.module.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.user.entity.ClubMember;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ClubMemberMapper extends BaseMapper<ClubMember> {
}
