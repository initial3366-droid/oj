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
     * 分页查询公告列表（管理员）
     */
    public PageResult<AnnouncementVO> listForAdmin(int page, int pageSize) {
        Page<Announcement> pageQuery = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        QueryWrapper<Announcement> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false)
                .orderByDesc("created_at");

        Page<Announcement> result = announcementMapper.selectPage(pageQuery, wrapper);
        List<AnnouncementVO> voList = result.getRecords().stream()
                .map(this::toVO)
                .toList();

        return new PageResult<>(result.getTotal(), voList);
    }

    /**
     * 分页查询可见公告列表（用户）
     */
    public PageResult<AnnouncementVO> listForUser(int page, int pageSize) {
        Page<Announcement> pageQuery = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        QueryWrapper<Announcement> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false)
                .eq("is_visible", true)
                .orderByDesc("created_at");

        Page<Announcement> result = announcementMapper.selectPage(pageQuery, wrapper);
        List<AnnouncementVO> voList = result.getRecords().stream()
                .map(this::toVO)
                .toList();

        return new PageResult<>(result.getTotal(), voList);
    }

    /**
     * 获取最新的N条公告（用户）
     */
    public List<AnnouncementVO> getLatest(int limit) {
        QueryWrapper<Announcement> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false)
                .eq("is_visible", true)
                .orderByDesc("created_at")
                .last("LIMIT " + normalizeLatestLimit(limit));

        return announcementMapper.selectList(wrapper).stream()
                .map(this::toVO)
                .toList();
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
     * 根据ID获取公告详情
     */
    public AnnouncementVO getById(Long id) {
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null || announcement.isDeleted) {
            throw new BizException(ErrorCode.NOT_FOUND, "公告不存在");
        }
        return toVO(announcement);
    }

    /**
     * 获取公告详情并增加浏览次数
     */
    @Transactional
    public AnnouncementVO getByIdAndIncrementView(Long id) {
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null || announcement.isDeleted) {
            throw new BizException(ErrorCode.NOT_FOUND, "公告不存在");
        }
        if (!announcement.isVisible) {
            throw new BizException(ErrorCode.FORBIDDEN, "公告不可见");
        }

        // 增加浏览次数
        announcement.viewCount = (announcement.viewCount == null ? 0 : announcement.viewCount) + 1;
        announcementMapper.updateById(announcement);

        return toVO(announcement);
    }

    /**
     * 创建公告
     */
    @Transactional
    public Long create(AnnouncementCreateRequest request, AuthUser authUser) {
        Announcement announcement = new Announcement();
        announcement.title = request.title;
        announcement.content = request.content;
        announcement.authorId = authUser.id();
        announcement.authorName = authUser.displayName();
        announcement.isVisible = request.isVisible != null ? request.isVisible : true;
        announcement.isDeleted = false;
        announcement.viewCount = 0;
        announcement.createdAt = LocalDateTime.now();
        announcement.updatedAt = LocalDateTime.now();

        announcementMapper.insert(announcement);
        return announcement.id;
    }

    /**
     * 更新公告
     */
    @Transactional
    public void update(Long id, AnnouncementUpdateRequest request) {
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
        announcement.updatedAt = LocalDateTime.now();

        announcementMapper.updateById(announcement);
    }

    /**
     * 删除公告（软删除）
     */
    @Transactional
    public void delete(Long id) {
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null || announcement.isDeleted) {
            throw new BizException(ErrorCode.NOT_FOUND, "公告不存在");
        }

        announcement.isDeleted = true;
        announcement.updatedAt = LocalDateTime.now();
        announcementMapper.updateById(announcement);
    }

    /**
     * 转换为VO
     */
    private AnnouncementVO toVO(Announcement announcement) {
        AnnouncementVO vo = new AnnouncementVO();
        vo.id = announcement.id;
        vo.title = announcement.title;
        vo.content = announcement.content;
        vo.authorId = announcement.authorId;
        vo.authorName = announcement.authorName;
        vo.isVisible = announcement.isVisible;
        vo.viewCount = announcement.viewCount;
        vo.createdAt = announcement.createdAt;
        vo.updatedAt = announcement.updatedAt;
        return vo;
    }
}
