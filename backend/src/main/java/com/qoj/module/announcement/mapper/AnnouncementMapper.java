package com.qoj.module.announcement.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.announcement.entity.Announcement;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AnnouncementMapper extends BaseMapper<Announcement> {
}
