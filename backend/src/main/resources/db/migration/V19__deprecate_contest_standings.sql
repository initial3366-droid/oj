-- V19: 废弃旧榜单表 contest_standings（保留以备兼容）
-- 新系统使用 contest_acm_rank_cache 和 contest_oi_rank_cache

-- 将旧表重命名为 _deprecated 以标记废弃状态
-- 保留数据以防万一需要回滚或数据迁移验证
RENAME TABLE contest_standings TO _deprecated_contest_standings;

-- 添加注释说明该表已废弃
ALTER TABLE _deprecated_contest_standings
COMMENT '已废弃：旧榜单系统，已迁移到 contest_acm_rank_cache 和 contest_oi_rank_cache';
