package com.qoj.module.practice.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.practice.entity.Practice;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface PracticeMapper extends BaseMapper<Practice> {
}
