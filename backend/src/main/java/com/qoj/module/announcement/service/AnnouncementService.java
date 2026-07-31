package com.qoj.module.announcement.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
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

/**
 * 公告业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class AnnouncementService {
    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_LATEST_LIMIT = 5;
    private static final int MAX_LATEST_LIMIT = 20;

    private final AnnouncementMapper announcementMapper;

    /**
     * 构造 公告Service 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
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
                .and(item -> item.eq("is_pinned", false).or().isNull("is_pinned"))
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
                .and(item -> item.eq("is_pinned", false).or().isNull("is_pinned"))
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
                .and(item -> item.eq("is_pinned", false).or().isNull("is_pinned"))
                .orderByDesc("created_at")
                .last("LIMIT " + normalizeLatestLimit(limit));

        return announcementMapper.selectList(wrapper).stream()
                .map(this::toVO)
                .toList();
    }

    /** Returns the single visible pinned announcement shown on the home page. */
    public AnnouncementVO getPinnedForUser() {
        QueryWrapper<Announcement> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false)
                .eq("is_visible", true)
                .eq("is_pinned", true)
                .orderByDesc("updated_at")
                .last("LIMIT 1");
        Announcement announcement = announcementMapper.selectOne(wrapper);
        return announcement == null ? null : toVO(announcement);
    }

    /** Returns the pinned announcement to the administrator, including hidden items. */
    public AnnouncementVO getPinnedForAdmin() {
        QueryWrapper<Announcement> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false)
                .eq("is_pinned", true)
                .orderByDesc("updated_at")
                .last("LIMIT 1");
        Announcement announcement = announcementMapper.selectOne(wrapper);
        return announcement == null ? null : toVO(announcement);
    }

    /**
     * 解析并规范化页面。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private int normalizePage(int page) {
        return Math.max(1, page);
    }

    /**
     * 解析并规范化页面Size。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private int normalizePageSize(int pageSize) {
        if (pageSize <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    /**
     * 解析并规范化LatestLimit。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
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
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "公告不存在");
        }
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(announcement);
    }

    /**
     * 获取用户可见的公告详情。
     */
    public AnnouncementVO getByIdForUser(Long id) {
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null || announcement.isDeleted) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "公告不存在");
        }
        if (!announcement.isVisible) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "公告不可见");
        }

        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
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
        announcement.isPinned = Boolean.TRUE.equals(request.isPinned);
        announcement.isDeleted = false;
        announcement.createdAt = LocalDateTime.now();
        announcement.updatedAt = LocalDateTime.now();

        if (announcement.isPinned) {
            /**
             * 重置Pinned公告。执行持久化写入。
             */
            clearPinnedAnnouncement(null, announcement.updatedAt);
        }

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
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
        }
        announcement.updatedAt = LocalDateTime.now();

        if (Boolean.TRUE.equals(request.isPinned)) {
            /**
             * 重置Pinned公告。执行持久化写入。
             */
            clearPinnedAnnouncement(id, announcement.updatedAt);
        }

        announcementMapper.updateById(announcement);
    }

    /**
     * 删除公告（软删除）
     */
    @Transactional
    public void delete(Long id) {
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null || announcement.isDeleted) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "公告不存在");
        }

        announcement.isDeleted = true;
        announcement.isPinned = false;
        announcement.updatedAt = LocalDateTime.now();
        announcementMapper.updateById(announcement);
    }

    /** Keeps the pinned slot unique when an administrator selects a new item. */
    private void clearPinnedAnnouncement(Long exceptId, LocalDateTime updatedAt) {
        UpdateWrapper<Announcement> wrapper = new UpdateWrapper<>();
        wrapper.eq("is_deleted", false)
                .eq("is_pinned", true);
        if (exceptId != null) {
            wrapper.ne("id", exceptId);
        }
        wrapper.set("is_pinned", false)
                .set("updated_at", updatedAt);
        announcementMapper.update(null, wrapper);
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
        vo.isPinned = announcement.isPinned;
        vo.createdAt = announcement.createdAt;
        vo.updatedAt = announcement.updatedAt;
        return vo;
    }
}
