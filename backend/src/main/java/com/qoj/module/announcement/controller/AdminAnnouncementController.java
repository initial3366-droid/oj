package com.qoj.module.announcement.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.announcement.dto.AnnouncementCreateRequest;
import com.qoj.module.announcement.dto.AnnouncementUpdateRequest;
import com.qoj.module.announcement.service.AnnouncementService;
import com.qoj.module.announcement.vo.AnnouncementVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 管理员公告接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/announcements")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminAnnouncementController {
    private final AnnouncementService announcementService;

    /**
     * 构造 管理员公告Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminAnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    /**
     * 获取公告列表（管理员）
     */
    @GetMapping
    public ApiResponse<PageResult<AnnouncementVO>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize
    ) {
        PageResult<AnnouncementVO> result = announcementService.listForAdmin(page, pageSize);
        return ApiResponse.ok(result);
    }

    /**
     * 获取独立的置顶公告编辑项。
     */
    @GetMapping("/pinned")
    public ApiResponse<AnnouncementVO> pinned() {
        return ApiResponse.ok(announcementService.getPinnedForAdmin());
    }

    /**
     * 获取公告详情（管理员）
     */
    @GetMapping("/{id}")
    public ApiResponse<AnnouncementVO> getById(@PathVariable Long id) {
        AnnouncementVO result = announcementService.getById(id);
        return ApiResponse.ok(result);
    }

    /**
     * 创建公告
     */
    @PostMapping
    public ApiResponse<Long> create(@Valid @RequestBody AnnouncementCreateRequest request) {
        AuthUser authUser = CurrentUser.required();
        Long id = announcementService.create(request, authUser);
        return ApiResponse.ok(id);
    }

    /**
     * 更新公告
     */
    @PutMapping("/{id}")
    public ApiResponse<Void> update(
            @PathVariable Long id,
            @Valid @RequestBody AnnouncementUpdateRequest request
    ) {
        announcementService.update(id, request);
        return ApiResponse.ok();
    }

    /**
     * 删除公告
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        announcementService.delete(id);
        return ApiResponse.ok();
    }
}
