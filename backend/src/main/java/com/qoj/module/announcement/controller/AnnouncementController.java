package com.qoj.module.announcement.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.announcement.service.AnnouncementService;
import com.qoj.module.announcement.vo.AnnouncementVO;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/announcements")
public class AnnouncementController {
    private final AnnouncementService announcementService;

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
     * 获取公告详情
     */
    @GetMapping("/{id}")
    public ApiResponse<AnnouncementVO> getById(@PathVariable Long id) {
        AnnouncementVO result = announcementService.getByIdAndIncrementView(id);
        return ApiResponse.ok(result);
    }
}
