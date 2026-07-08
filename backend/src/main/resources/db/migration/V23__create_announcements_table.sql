-- V23: 创建公告表
-- 用于系统公告管理

CREATE TABLE announcements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '公告ID',
    title VARCHAR(200) NOT NULL COMMENT '公告标题',
    content TEXT NOT NULL COMMENT '公告内容',
    author_id BIGINT NOT NULL COMMENT '发布者ID',
    author_name VARCHAR(100) NOT NULL COMMENT '发布者姓名（冗余）',
    is_visible BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否可见',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否删除（软删除）',
    view_count INT NOT NULL DEFAULT 0 COMMENT '浏览次数',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_visible_deleted (is_visible, is_deleted),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_author (author_id)
) COMMENT '系统公告表';
