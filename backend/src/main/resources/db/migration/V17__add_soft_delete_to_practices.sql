-- V17: 添加 Practice 软删除支持

ALTER TABLE practices
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL COMMENT '是否已删除';

ALTER TABLE practices
ADD COLUMN deleted_at DATETIME NULL COMMENT '删除时间';

CREATE INDEX idx_practices_is_deleted ON practices(is_deleted);
