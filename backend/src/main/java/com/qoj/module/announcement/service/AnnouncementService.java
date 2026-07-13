package com.qoj.module.announcement.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.qoj.common.ErrorCode;
import com.qoj.common.PageResult;
import com.qoj.common.exception.BizException;
import com.qoj.module.announcement.dto.AnnouncementCreateRequest;
import com.qoj.module.announcement.dto.AnnouncementUpdateRequest;
import com.qoj.module.announcement.entity.Announcement;
import com.qoj.module.announcement.mapper.AnnouncementMapper;
import com.qoj.module.announcement.vo.AnnouncementVO;
import com.qoj.security.AuthUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AnnouncementService {
    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_LATEST_LIMIT = 5;
    private static final int MAX_LATEST_LIMIT = 20;

    private final AnnouncementMapper announcementMapper;

    public AnnouncementService(AnnouncementMapper announcementMapper) {
        this.announcementMapper = announcementMapper;
    }

    /**
     * 分页查询公告列表（管理员）：普通公告列表不包含置顶公告。
     */
    public PageResult<AnnouncementVO> listForAdmin(int page, int pageSize) {
        Page<Announcement> pageQuery = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        QueryWrapper<Announcement> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false)
                .eq("is_pinned", false)
                .orderByDesc("created_at");

        Page<Announcement> result = announcementMapper.selectPage(pageQuery, wrapper);
        List<AnnouncementVO> voList = result.getRecords().stream()
                .map(this::toVO)
                .toList();

        return new PageResult<>(result.getTotal(), voList);
    }

    /**
     * 分页查询可见公告列表（用户）：普通公告列表不包含置顶公告。
     */
    public PageResult<AnnouncementVO> listForUser(int page, int pageSize) {
        Page<Announcement> pageQuery = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        QueryWrapper<Announcement> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false)
                .eq("is_visible", true)
                .eq("is_pinned", false)
                .orderByDesc("created_at");

        Page<Announcement> result = announcementMapper.selectPage(pageQuery, wrapper);
        List<AnnouncementVO> voList = result.getRecords().stream()
                .map(this::toVO)
                .toList();

        return new PageResult<>(result.getTotal(), voList);
    }

    /**
     * 获取最新的N条普通公告（用户）。
     */
    public List<AnnouncementVO> getLatest(int limit) {
        QueryWrapper<Announcement> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false)
                .eq("is_visible", true)
                .eq("is_pinned", false)
                .orderByDesc("created_at")
                .last("LIMIT " + normalizeLatestLimit(limit));

        return announcementMapper.selectList(wrapper).stream()
                .map(this::toVO)
                .toList();
    }

    /**
     * 获取首页置顶公告（用户）。
     */
    public AnnouncementVO getPinnedForUser() {
        Announcement announcement = announcementMapper.selectOne(
            new QueryWrapper<Announcement>()
                .eq("is_deleted", false)
                .eq("is_visible", true)
                .eq("is_pinned", true)
                .orderByDesc("updated_at")
                .last("LIMIT 1")
        );
        return announcement == null ? null : toVO(announcement);
    }

    /**
     * 获取后台置顶公告（包含隐藏状态）。
     */
    public AnnouncementVO getPinnedForAdmin() {
        Announcement announcement = announcementMapper.selectOne(
            new QueryWrapper<Announcement>()
                .eq("is_deleted", false)
                .eq("is_pinned", true)
                .orderByDesc("updated_at")
                .last("LIMIT 1")
        );
        return announcement == null ? null : toVO(announcement);
    }

    private int normalizePage(int page) {
        return Math.max(1, page);
    }

    private int normalizePageSize(int pageSize) {
        if (pageSize <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private int normalizeLatestLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_LATEST_LIMIT;
        }
        return Math.min(limit, MAX_LATEST_LIMIT);
    }

    /**
     * 根据ID获取公告详情（管理员）。
     */
    public AnnouncementVO getById(Long id) {
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null || announcement.isDeleted) {
            throw new BizException(ErrorCode.NOT_FOUND, "公告不存在");
        }
        return toVO(announcement);
    }

    /**
     * 获取用户可见公告详情，不再统计浏览次数。
     */
    public AnnouncementVO getByIdForUser(Long id) {
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null || announcement.isDeleted) {
            throw new BizException(ErrorCode.NOT_FOUND, "公告不存在");
        }
        if (!announcement.isVisible) {
            throw new BizException(ErrorCode.FORBIDDEN, "公告不可见");
        }
        return toVO(announcement);
    }

    /**
     * 创建公告。
     */
    @Transactional
    public Long create(AnnouncementCreateRequest request, AuthUser authUser) {
        requireSuperAdmin(authUser);
        Announcement announcement = new Announcement();
        announcement.title = request.title;
        announcement.content = request.content;
        announcement.authorId = authUser.id();
        announcement.authorName = authUser.displayName();
        announcement.isVisible = request.isVisible != null ? request.isVisible : true;
        announcement.isPinned = Boolean.TRUE.equals(request.isPinned);
        announcement.isDeleted = false;
        announcement.createdAt = LocalDateTime.now();
        announcement.updatedAt = LocalDateTime.now();

        if (Boolean.TRUE.equals(announcement.isPinned)) {
            clearPinned(null);
        }
        announcementMapper.insert(announcement);
        return announcement.id;
    }

    /**
     * 更新公告。
     */
    @Transactional
    public void update(Long id, AnnouncementUpdateRequest request, AuthUser authUser) {
        requireSuperAdmin(authUser);
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null || announcement.isDeleted) {
            throw new BizException(ErrorCode.NOT_FOUND, "公告不存在");
        }

        if (request.title != null) {
            announcement.title = request.title;
        }
        if (request.content != null) {
            announcement.content = request.content;
        }
        if (request.isVisible != null) {
            announcement.isVisible = request.isVisible;
        }
        if (request.isPinned != null) {
            announcement.isPinned = request.isPinned;
            if (Boolean.TRUE.equals(request.isPinned)) {
                clearPinned(id);
            }
        }
        announcement.updatedAt = LocalDateTime.now();

        announcementMapper.updateById(announcement);
    }

    /**
     * 删除公告（软删除）。
     */
    @Transactional
    public void delete(Long id, AuthUser authUser) {
        requireSuperAdmin(authUser);
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null || announcement.isDeleted) {
            throw new BizException(ErrorCode.NOT_FOUND, "公告不存在");
        }

        announcement.isDeleted = true;
        announcement.isPinned = false;
        announcement.updatedAt = LocalDateTime.now();
        announcementMapper.updateById(announcement);
    }

    private void requireSuperAdmin(AuthUser authUser) {
        if (authUser == null || !authUser.isAdmin()) {
            throw new BizException(ErrorCode.FORBIDDEN, "只有超级管理员可以修改公告");
        }
    }

    private void clearPinned(Long exceptId) {
        List<Announcement> pinnedList = announcementMapper.selectList(
            new QueryWrapper<Announcement>()
                .eq("is_deleted", false)
                .eq("is_pinned", true)
        );
        LocalDateTime now = LocalDateTime.now();
        for (Announcement pinned : pinnedList) {
            if (exceptId != null && exceptId.equals(pinned.id)) {
                continue;
            }
            pinned.isPinned = false;
            pinned.updatedAt = now;
            announcementMapper.updateById(pinned);
        }
    }

    /**
     * 转换为VO。
     */
    private AnnouncementVO toVO(Announcement announcement) {
        AnnouncementVO vo = new AnnouncementVO();
        vo.id = announcement.id;
        vo.title = announcement.title;
        vo.content = announcement.content;
        vo.authorId = announcement.authorId;
        vo.authorName = announcement.authorName;
        vo.isVisible = announcement.isVisible;
        vo.isPinned = announcement.isPinned;
        vo.createdAt = announcement.createdAt;
        vo.updatedAt = announcement.updatedAt;
        return vo;
    }
}
