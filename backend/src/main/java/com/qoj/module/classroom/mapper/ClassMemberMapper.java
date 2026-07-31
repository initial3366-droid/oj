package com.qoj.module.classroom.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.classroom.entity.ClassMember;
import org.apache.ibatis.annotations.Mapper;

/**
 * 班级Member数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ClassMemberMapper extends BaseMapper<ClassMember> {
}
