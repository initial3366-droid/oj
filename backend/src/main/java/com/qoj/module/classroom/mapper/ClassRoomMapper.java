package com.qoj.module.classroom.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.classroom.entity.ClassRoom;
import org.apache.ibatis.annotations.Mapper;

/**
 * 班级Room数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ClassRoomMapper extends BaseMapper<ClassRoom> {
}
