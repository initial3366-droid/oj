package com.qoj.module.announcement.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.announcement.entity.Announcement;
import org.apache.ibatis.annotations.Mapper;

/**
 * 公告数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface AnnouncementMapper extends BaseMapper<Announcement> {
}
