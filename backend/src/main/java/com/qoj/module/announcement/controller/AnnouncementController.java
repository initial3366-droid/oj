package com.qoj.module.announcement.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.announcement.service.AnnouncementService;
import com.qoj.module.announcement.vo.AnnouncementVO;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 公告接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/announcements")
public class AnnouncementController {
    private final AnnouncementService announcementService;

    /**
     * 构造 公告Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    /**
     * 获取公告列表（用户）
     */
    @GetMapping
    public ApiResponse<PageResult<AnnouncementVO>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize
    ) {
        PageResult<AnnouncementVO> result = announcementService.listForUser(page, pageSize);
        return ApiResponse.ok(result);
    }

    /**
     * 获取最新公告
     */
    @GetMapping("/latest")
    public ApiResponse<List<AnnouncementVO>> latest(
            @RequestParam(defaultValue = "5") int limit
    ) {
        List<AnnouncementVO> result = announcementService.getLatest(limit);
        return ApiResponse.ok(result);
    }

    /**
     * 获取首页置顶公告；没有置顶公告时返回 null。
     */
    @GetMapping("/pinned")
    public ApiResponse<AnnouncementVO> pinned() {
        return ApiResponse.ok(announcementService.getPinnedForUser());
    }

    /**
     * 获取公告详情
     */
    @GetMapping("/{id}")
    public ApiResponse<AnnouncementVO> getById(@PathVariable Long id) {
        AnnouncementVO result = announcementService.getByIdForUser(id);
        return ApiResponse.ok(result);
    }
}
