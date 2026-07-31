package com.qoj.module.home.vo;

import com.qoj.module.contest.vo.ContestVO;
import java.util.List;

/**
 * 首页配置响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record HomeConfigVO(
    List<CarouselSlideVO> carouselSlides,
    List<ContestVO> recentContests
) {
}
