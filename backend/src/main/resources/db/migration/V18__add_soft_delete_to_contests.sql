-- V18: 添加 Contest 软删除支持

ALTER TABLE contests
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL COMMENT '是否已删除';

ALTER TABLE contests
ADD COLUMN deleted_at DATETIME NULL COMMENT '删除时间';

CREATE INDEX idx_contests_is_deleted ON contests(is_deleted);
