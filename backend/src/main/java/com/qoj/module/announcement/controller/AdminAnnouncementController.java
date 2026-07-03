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

@RestController
@RequestMapping("/api/admin/v1/announcements")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminAnnouncementController {
    private final AnnouncementService announcementService;

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
