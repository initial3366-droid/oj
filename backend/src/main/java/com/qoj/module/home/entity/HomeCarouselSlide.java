package com.qoj.module.home.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 首页CarouselSlide持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("home_carousel_slides")
public class HomeCarouselSlide {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String title;
    public String imageUrl;
    public String cta;
    public String targetUrl;
    public Integer displayOrder;
    public Boolean enabled;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
