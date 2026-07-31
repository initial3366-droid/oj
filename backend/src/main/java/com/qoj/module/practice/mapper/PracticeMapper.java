package com.qoj.module.practice.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.practice.entity.Practice;
import org.apache.ibatis.annotations.Mapper;

/**
 * 练习数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface PracticeMapper extends BaseMapper<Practice> {
}
