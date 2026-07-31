/**
 * 首页服务 — 每日一题、轮播图、最近比赛的配置与管理。
 *
 * 每日一题逻辑：
 * - MANUAL 模式：使用管理员指定的固定题目
 * - RANDOM 模式：基于日期哈希从公开题库随机选取，排除最近 7 天出现过的题目
 * - 同一天所有用户看到同一道题
 *
 * 轮播图：管理员 CRUD，公开首页仅返回 enabled=true 的 slides
 */
package com.qoj.module.home.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.service.ContestService;
import com.qoj.module.contest.vo.ContestVO;
import com.qoj.module.home.dto.CarouselSlideRequest;
import com.qoj.module.home.entity.HomeCarouselSlide;
import com.qoj.module.home.mapper.HomeCarouselSlideMapper;
import com.qoj.module.home.vo.CarouselSlideVO;
import com.qoj.module.home.vo.HomeConfigVO;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 首页业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class HomeService {
    private final HomeCarouselSlideMapper carouselSlideMapper;
    private final ContestMapper contestMapper;
    private final ContestService contestService;

    /**
     * 构造 首页Service 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public HomeService(
        HomeCarouselSlideMapper carouselSlideMapper,
        ContestMapper contestMapper,
        ContestService contestService
    ) {
        this.carouselSlideMapper = carouselSlideMapper;
        this.contestMapper = contestMapper;
        this.contestService = contestService;
    }

    public HomeConfigVO publicHome() {
        List<CarouselSlideVO> slides = carouselSlideMapper
            .selectList(
                new QueryWrapper<HomeCarouselSlide>()
                    .eq("enabled", true)
                    .orderByAsc("display_order")
            )
            .stream()
            .map(this::toVO)
            .toList();

        List<ContestVO> recentContests = contestMapper
            .selectList(new QueryWrapper<Contest>()
                .eq("is_deleted", false)
                .orderByDesc("start_time")
                .last("LIMIT 5"))
            .stream()
            .map(item -> {
                try {
                    return contestService.detail(item.id);
                } catch (Exception e) {
                    return null;
                }
            })
            .filter(java.util.Objects::nonNull)
            .toList();
        /**
         * 封装首页配置VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new HomeConfigVO(
            slides,
            recentContests
        );
    }

    public List<CarouselSlideVO> listSlidesForAdmin() {
        return carouselSlideMapper
            .selectList(new QueryWrapper<HomeCarouselSlide>().orderByAsc("display_order"))
            .stream()
            .map(this::toVO)
            .toList();
    }

    @Transactional
    public CarouselSlideVO createSlide(CarouselSlideRequest request) {
        HomeCarouselSlide slide = new HomeCarouselSlide();
        apply(slide, request);
        carouselSlideMapper.insert(slide);
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(slide);
    }

    @Transactional
    public CarouselSlideVO updateSlide(long id, CarouselSlideRequest request) {
        HomeCarouselSlide slide = carouselSlideMapper.selectById(id);
        if (slide == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "轮播图不存在");
        }
        apply(slide, request);
        carouselSlideMapper.updateById(slide);
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(slide);
    }

    @Transactional
    public void deleteSlide(long id) {
        carouselSlideMapper.deleteById(id);
    }

    private void apply(HomeCarouselSlide slide, CarouselSlideRequest request) {
        slide.title = request.title();
        slide.imageUrl = request.imageUrl();
        slide.cta = request.cta() != null ? request.cta() : "";
        slide.targetUrl = request.targetUrl() != null ? request.targetUrl() : "";
        slide.displayOrder = request.displayOrder();
        slide.enabled = !Boolean.FALSE.equals(request.enabled());
    }

    private CarouselSlideVO toVO(HomeCarouselSlide slide) {
        /**
         * 封装CarouselSlideVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new CarouselSlideVO(
            slide.id,
            slide.title,
            slide.imageUrl,
            slide.cta,
            slide.targetUrl,
            slide.displayOrder,
            slide.enabled
        );
    }

}
