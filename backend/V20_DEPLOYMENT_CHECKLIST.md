# V20 数据库优化实施检查清单

## 📋 实施前检查

### 环境准备
- [ ] 已备份生产数据库
- [ ] 测试环境已准备就绪
- [ ] 已确认数据库版本（MySQL 8.0+）
- [ ] 已确认有足够磁盘空间（需额外 135MB）
- [ ] 已通知相关开发人员

### 文档准备
- [x] V20 迁移脚本已创建
- [x] 优化报告已生成
- [x] 索引变更清单已准备
- [x] 回滚脚本已准备
- [x] 执行总结已编写

---

## 🧪 测试环境验证

### 步骤1: 启动测试数据库
```bash
cd /Users/initial/qoj
docker compose -f .runtime/qoj-deps.compose.yml up -d
```

- [ ] MySQL 容器已启动
- [ ] Redis 容器已启动
- [ ] 数据库连接正常

### 步骤2: 应用迁移
```bash
cd backend
mvn flyway:info    # 查看迁移状态
mvn flyway:migrate # 执行迁移
```

- [ ] 迁移执行成功（无错误）
- [ ] V20 状态显示为 Success
- [ ] 执行时间记录：_______秒

### 步骤3: 验证索引创建
```sql
-- 检查 submissions 表索引
SHOW INDEX FROM submissions WHERE Key_name LIKE 'idx_%';

-- 检查 problems 表索引  
SHOW INDEX FROM problems WHERE Key_name LIKE 'idx_%';

-- 检查 contests 表索引
SHOW INDEX FROM contests WHERE Key_name LIKE 'idx_%';
```

- [ ] submissions 表有 3 个新增索引
- [ ] problems 表删除了旧索引，新增了 2 个索引
- [ ] contests 表删除了旧索引，新增了 2 个索引
- [ ] 所有新索引创建成功

### 步骤4: 验证外键约束
```sql
SELECT 
  TABLE_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'qoj'
  AND CONSTRAINT_NAME = 'fk_submissions_participant';
```

- [ ] fk_submissions_participant 外键已创建

### 步骤5: 验证唯一约束
```sql
SHOW INDEX FROM home_daily_problem_config 
WHERE Key_name = 'uk_daily_problem_singleton';

SHOW INDEX FROM practice_problems 
WHERE Key_name = 'uk_practice_display_order';
```

- [ ] uk_daily_problem_singleton 已创建
- [ ] uk_practice_display_order 已创建

### 步骤6: 验证表注释
```sql
SELECT 
  TABLE_NAME,
  TABLE_COMMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'qoj'
  AND TABLE_NAME IN ('users', 'problems', 'contests', 'submissions')
ORDER BY TABLE_NAME;
```

- [ ] 表注释已添加且为中文

---

## 🎯 性能测试

### 测试1: 用户提交历史查询
```sql
-- 开启性能分析
SET profiling = 1;

-- 执行查询
SELECT * FROM submissions 
WHERE user_id = 1 AND status = 'AC' 
ORDER BY created_at DESC LIMIT 50;

-- 查看执行计划
EXPLAIN SELECT * FROM submissions 
WHERE user_id = 1 AND status = 'AC' 
ORDER BY created_at DESC LIMIT 50;
```

**验证点**:
- [ ] EXPLAIN 显示使用 idx_user_status_time 索引
- [ ] type = ref 或 range
- [ ] 查询时间记录：优化前 _____ms，优化后 _____ms
- [ ] 性能提升：_____% 

### 测试2: 题目AC率统计
```sql
EXPLAIN SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'AC' THEN 1 ELSE 0 END) as ac_count
FROM submissions 
WHERE problem_id = 1;
```

**验证点**:
- [ ] EXPLAIN 显示使用 idx_problem_status 索引
- [ ] type = ref
- [ ] 查询时间记录：优化前 _____ms，优化后 _____ms
- [ ] 性能提升：_____% 

### 测试3: 公开题目列表
```sql
EXPLAIN SELECT * FROM problems 
WHERE is_deleted = FALSE AND is_public = TRUE 
ORDER BY difficulty LIMIT 50;
```

**验证点**:
- [ ] EXPLAIN 显示使用 idx_problems_deleted_public_difficulty 索引
- [ ] type = ref
- [ ] 查询时间记录：优化前 _____ms，优化后 _____ms
- [ ] 性能提升：_____% 

### 测试4: 排行榜查询
```sql
EXPLAIN SELECT user_id, rating, ac_count, total_score 
FROM user_scores 
ORDER BY rating DESC, ac_count DESC, total_score DESC 
LIMIT 100;
```

**验证点**:
- [ ] EXPLAIN 显示使用 idx_user_scores_ranking 索引
- [ ] type = index（全索引扫描）
- [ ] Extra 包含 Using index（覆盖索引）
- [ ] 查询时间记录：优化前 _____ms，优化后 _____ms
- [ ] 性能提升：_____% 

### 测试5: 比赛时间范围查询
```sql
EXPLAIN SELECT * FROM contests 
WHERE start_time <= NOW() AND end_time >= NOW()
  AND is_deleted = FALSE;
```

**验证点**:
- [ ] EXPLAIN 显示使用索引
- [ ] 查询时间记录：优化前 _____ms，优化后 _____ms
- [ ] 性能提升：_____% 

---

## 📊 数据库状态检查

### 检查索引大小
```sql
SELECT 
  table_name,
  ROUND((data_length) / 1024 / 1024, 2) AS 'Data (MB)',
  ROUND((index_length) / 1024 / 1024, 2) AS 'Index (MB)',
  ROUND((data_length + index_length) / 1024 / 1024, 2) AS 'Total (MB)'
FROM information_schema.tables 
WHERE table_schema = 'qoj' 
  AND table_name IN ('submissions', 'problems', 'contests', 'user_scores')
ORDER BY (data_length + index_length) DESC;
```

**记录**:
- submissions 索引大小：_____MB
- problems 索引大小：_____MB
- contests 索引大小：_____MB
- user_scores 索引大小：_____MB
- 总索引增加：_____MB

### 检查索引碎片
```sql
SELECT 
  table_name,
  ROUND(data_free / 1024 / 1024, 2) AS 'Fragmentation (MB)'
FROM information_schema.tables 
WHERE table_schema = 'qoj' 
  AND data_free > 0
ORDER BY data_free DESC;
```

- [ ] 碎片空间小于总空间的 10%

### 更新统计信息
```sql
ANALYZE TABLE users, problems, contests, submissions;
ANALYZE TABLE contest_participants, user_problem_status;
ANALYZE TABLE contest_acm_rank_cache, contest_oi_rank_cache;
```

- [ ] 统计信息已更新

---

## 🚀 生产环境部署

### 部署前准备
- [ ] 测试环境验证全部通过
- [ ] 性能测试结果符合预期
- [ ] 选择低峰期时段（建议：凌晨2-4点）
- [ ] 通知运维团队待命
- [ ] 准备回滚脚本

### 数据库备份
```bash
# 完整备份
mysqldump -h<HOST> -P<PORT> -u<USER> -p<PASSWORD> qoj \
  > qoj_backup_$(date +%Y%m%d_%H%M%S).sql

# 仅结构备份
mysqldump -h<HOST> -P<PORT> -u<USER> -p<PASSWORD> qoj \
  --no-data > qoj_schema_backup_$(date +%Y%m%d_%H%M%S).sql
```

- [ ] 完整备份已完成
- [ ] 备份文件已验证可恢复
- [ ] 备份文件大小：_____MB
- [ ] 备份存储位置：_______________

### 执行迁移
```bash
cd backend
mvn flyway:migrate
```

- [ ] 迁移执行成功
- [ ] 执行时间：_____秒
- [ ] 无错误日志

### 生产环境验证
```sql
-- 快速验证索引
SHOW INDEX FROM submissions WHERE Key_name = 'idx_user_status_time';
SHOW INDEX FROM problems WHERE Key_name = 'idx_problems_deleted_public_difficulty';
SHOW INDEX FROM user_scores WHERE Key_name = 'idx_user_scores_ranking';
```

- [ ] 关键索引已创建
- [ ] 应用启动成功
- [ ] 首页可访问
- [ ] 关键功能测试通过

---

## 📈 部署后监控（24小时）

### 性能指标监控

#### 小时 1-2（立即监控）
```sql
-- 检查慢查询
SELECT * FROM mysql.slow_log 
WHERE start_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY query_time DESC LIMIT 20;
```

- [ ] 无新增慢查询（>1秒）
- [ ] CPU 使用率正常（< 70%）
- [ ] 内存使用正常
- [ ] 磁盘 I/O 正常

#### 小时 3-6（持续监控）
```sql
-- 检查索引使用情况
SELECT 
  object_schema,
  object_name,
  index_name,
  COUNT_STAR
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE object_schema = 'qoj'
  AND index_name LIKE 'idx_%'
ORDER BY COUNT_STAR DESC;
```

- [ ] 新索引被正常使用
- [ ] 无异常告警
- [ ] 用户反馈正常

#### 小时 12-24（稳定性监控）
- [ ] 数据库连接数正常
- [ ] 查询响应时间在预期范围
- [ ] 无锁等待超时
- [ ] 业务指标正常

### 关键查询响应时间对比

| 查询类型 | 优化前 | 优化后 | 提升 |
|---------|-------|-------|------|
| 用户提交历史 | _____ms | _____ms | _____% |
| 题目AC率统计 | _____ms | _____ms | _____% |
| 公开题目列表 | _____ms | _____ms | _____% |
| 排行榜查询 | _____ms | _____ms | _____% |
| 比赛时间查询 | _____ms | _____ms | _____% |

---

## ⚠️ 回滚方案

### 何时需要回滚
- [ ] 性能不升反降（>20%）
- [ ] 出现严重慢查询（>5秒）
- [ ] 数据库负载异常升高
- [ ] 业务功能异常

### 回滚步骤
```bash
# 1. 停止应用（如果必要）
# 2. 连接数据库
mysql -h<HOST> -P<PORT> -u<USER> -p<PASSWORD> qoj

# 3. 执行回滚脚本
source /path/to/rollback_v20.sql

# 4. 验证回滚成功
SHOW INDEX FROM submissions;
SHOW INDEX FROM problems;

# 5. 重启应用
```

- [ ] 回滚脚本已测试
- [ ] 回滚步骤已演练

---

## ✅ 完成标志

### 测试环境
- [ ] V20 迁移执行成功
- [ ] 索引创建验证通过
- [ ] 性能测试达到预期
- [ ] 所有验证点通过

### 生产环境
- [ ] V20 迁移执行成功
- [ ] 24小时监控无异常
- [ ] 性能提升符合预期
- [ ] 用户体验改善
- [ ] 项目文档已更新

---

## 📝 后续行动

### 短期（1-2周）
- [ ] 收集性能监控数据
- [ ] 分析索引使用情况
- [ ] 评估冗余字段清理可行性
- [ ] 准备 V21 优化方案

### 中期（1-3月）
- [ ] 实施数据类型优化
- [ ] JSON 字段优化
- [ ] 审计字段补充

### 长期（3-6月）
- [ ] 字段命名标准化
- [ ] 分区表实施（如需要）
- [ ] 数据归档策略

---

## 📞 联系信息

**执行人**: _______________  
**执行时间**: _______________  
**验证人**: _______________  
**审批人**: _______________  

**问题反馈**:
- 开发团队联系人: _______________
- 运维团队联系人: _______________
- 紧急联系方式: _______________

---

**检查清单版本**: 1.0  
**最后更新**: 2026-06-13  
**适用迁移**: V20__optimize_database_schema.sql
