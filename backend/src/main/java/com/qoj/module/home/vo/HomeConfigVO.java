package com.qoj.module.home.vo;

import com.qoj.module.contest.vo.ContestVO;
import java.util.List;

public record HomeConfigVO(
    List<CarouselSlideVO> carouselSlides,
    List<ContestVO> recentContests
) {
}
