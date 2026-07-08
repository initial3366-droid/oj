-- 添加软删除字段到problems表

ALTER TABLE problems
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL COMMENT '是否已删除';

ALTER TABLE problems
ADD COLUMN deleted_at DATETIME NULL COMMENT '删除时间';

-- 为软删除字段添加索引
CREATE INDEX idx_problems_is_deleted ON problems(is_deleted);
