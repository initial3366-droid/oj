# V20 迁移脚本索引变更清单

## 新增索引列表

### submissions 表（3个新增索引）

| 索引名 | 列 | 类型 | 用途 | 预期提升 |
|-------|-----|------|------|---------|
| idx_user_status_time | (user_id, status, created_at DESC) | 复合索引 | 用户提交历史查询 | 50-80% |
| idx_problem_status | (problem_id, status) | 复合索引 | 题目AC率统计 | 60-90% |
| idx_submissions_created_at | (created_at DESC) | 单列索引 | 全局提交时间排序 | 40-70% |

**SQL示例**:
```sql
-- 使用 idx_user_status_time
SELECT * FROM submissions 
WHERE user_id = 1 AND status = 'AC' 
ORDER BY created_at DESC LIMIT 50;

-- 使用 idx_problem_status
SELECT COUNT(*) as total,
  SUM(CASE WHEN status = 'AC' THEN 1 ELSE 0 END) as ac_count
FROM submissions WHERE problem_id = 1;
```

---

### problems 表（2个新增索引，1个删除）

| 操作 | 索引名 | 列 | 说明 |
|-----|-------|-----|------|
| ❌ 删除 | idx_problems_is_deleted | (is_deleted) | 单列索引效率低 |
| ✅ 新增 | idx_problems_public_deleted | (is_public, is_deleted) | 公开题目快速过滤 |
| ✅ 新增 | idx_problems_deleted_public_difficulty | (is_deleted, is_public, difficulty) | 支持难度排序的覆盖索引 |

**SQL示例**:
```sql
-- 使用 idx_problems_deleted_public_difficulty（覆盖索引）
SELECT id, title, difficulty FROM problems 
WHERE is_deleted = FALSE AND is_public = TRUE 
ORDER BY difficulty, id LIMIT 50;
```

---

### contests 表（2个新增索引，1个删除）

| 操作 | 索引名 | 列 | 说明 |
|-----|-------|-----|------|
| ❌ 删除 | idx_contests_is_deleted | (is_deleted) | 单列索引效率低 |
| ✅ 新增 | idx_contests_deleted_status_time | (is_deleted, status, start_time DESC) | 比赛状态查询优化 |
| ✅ 新增 | idx_contests_time_range | (start_time, end_time) | 时间范围查询优化 |

**SQL示例**:
```sql
-- 使用 idx_contests_deleted_status_time
SELECT * FROM contests 
WHERE is_deleted = FALSE AND status = 'RUNNING' 
ORDER BY start_time DESC;

-- 使用 idx_contests_time_range
SELECT * FROM contests 
WHERE start_time <= NOW() AND end_time >= NOW();
```

---

### practices 表（1个新增索引，1个删除）

| 操作 | 索引名 | 列 | 说明 |
|-----|-------|-----|------|
| ❌ 删除 | idx_practices_is_deleted | (is_deleted) | 单列索引效率低 |
| ✅ 新增 | idx_practices_deleted_published | (is_deleted, published) | 练习集列表查询优化 |

**SQL示例**:
```sql
-- 使用 idx_practices_deleted_published
SELECT * FROM practices 
WHERE is_deleted = FALSE AND published = TRUE;
```

---

### contest_registrations 表（1个新增索引）

| 索引名 | 列 | 类型 | 用途 | 预期提升 |
|-------|-----|------|------|---------|
| idx_contest_registrations_user | (user_id) | 单列索引 | 用户报名历史查询 | 70-95% |

**SQL示例**:
```sql
-- 使用 idx_contest_registrations_user
SELECT c.* FROM contest_registrations r
JOIN contests c ON c.id = r.contest_id
WHERE r.user_id = 1 ORDER BY r.registered_at DESC;
```

---

### user_problem_status 表（1个新增索引）

| 索引名 | 列 | 类型 | 用途 | 预期提升 |
|-------|-----|------|------|---------|
| idx_user_best_status | (user_id, best_status) | 复合索引 | 用户AC题目列表 | 60-85% |

**SQL示例**:
```sql
-- 使用 idx_user_best_status
SELECT problem_id FROM user_problem_status 
WHERE user_id = 1 AND best_status = 'AC';
```

---

### contest_participants 表（1个新增索引）

| 索引名 | 列 | 类型 | 用途 | 预期提升 |
|-------|-----|------|------|---------|
| idx_participants_registered_at | (registered_at DESC) | 单列索引 | 报名时间排序 | 40-60% |

**SQL示例**:
```sql
-- 使用 idx_participants_registered_at
SELECT * FROM contest_participants 
WHERE contest_id = 1 
ORDER BY registered_at DESC LIMIT 50;
```

---

### user_scores 表（1个新增索引）

| 索引名 | 列 | 类型 | 用途 | 预期提升 |
|-------|-----|------|------|---------|
| idx_user_scores_ranking | (rating DESC, ac_count DESC, total_score DESC) | 复合索引 | 全局排行榜查询 | 60-85% |

**SQL示例**:
```sql
-- 使用 idx_user_scores_ranking
SELECT user_id, rating, ac_count, total_score 
FROM user_scores 
ORDER BY rating DESC, ac_count DESC, total_score DESC 
LIMIT 100;
```

---

### class_members 表（1个新增索引）

| 索引名 | 列 | 类型 | 用途 | 预期提升 |
|-------|-----|------|------|---------|
| idx_class_members_class | (class_id, joined_at DESC) | 复合索引 | 班级成员列表 | 50-70% |

---

### club_members 表（1个新增索引）

| 索引名 | 列 | 类型 | 用途 | 预期提升 |
|-------|-----|------|------|---------|
| idx_club_members_club | (club_id, joined_at DESC) | 复合索引 | 社团成员列表 | 50-70% |

---

## 索引统计总结

### 按操作类型

| 操作 | 数量 | 表列表 |
|-----|------|--------|
| ✅ 新增索引 | 14 | submissions(3), problems(2), contests(2), practices(1), contest_registrations(1), user_problem_status(1), contest_participants(1), user_scores(1), class_members(1), club_members(1) |
| ❌ 删除索引 | 3 | problems(1), contests(1), practices(1) |
| **净增加** | **11** | - |

### 按索引类型

| 类型 | 数量 | 说明 |
|-----|------|------|
| 复合索引 | 11 | 支持多条件查询和排序 |
| 单列索引 | 3 | 简单查询场景 |

### 存储空间估算

| 表名 | 新增索引数 | 估算增加空间 | 当前表大小估算 |
|-----|----------|------------|--------------|
| submissions | 3 | +75MB | ~500MB |
| problems | 2 | +15MB | ~100MB |
| contests | 2 | +8MB | ~50MB |
| practices | 1 | +3MB | ~30MB |
| contest_registrations | 1 | +5MB | ~40MB |
| user_problem_status | 1 | +25MB | ~200MB |
| contest_participants | 1 | +4MB | ~30MB |
| user_scores | 1 | +6MB | ~50MB |
| class_members | 1 | +2MB | ~20MB |
| club_members | 1 | +2MB | ~20MB |
| **总计** | **14** | **+145MB** | **~1040MB** |

**净增加**: +145MB - 10MB (删除的3个索引) = **约135MB (13%)**

---

## 外键约束变更

### 新增外键

| 表 | 字段 | 引用表 | 引用字段 | 级联操作 |
|----|------|--------|---------|---------|
| submissions | participant_id | contest_participants | id | ON DELETE SET NULL |

---

## 唯一约束变更

### 新增唯一约束

| 表 | 约束名 | 字段 | 说明 |
|----|-------|------|------|
| home_daily_problem_config | uk_daily_problem_singleton | (id) | 确保只有一条配置记录 |
| practice_problems | uk_practice_display_order | (practice_id, display_order) | 防止同一练习集内排序重复 |

---

## 主键变更

### 修改主键

| 表 | 原主键 | 新主键 | 说明 |
|----|-------|--------|------|
| contest_problem_case_scores | (contest_id, problem_id, case_no) | (contest_id, problem_id, case_no) | 确保主键完整性 |

---

## 表注释变更

为以下24张表添加了中文注释：

- users, admin_users, classes, class_members
- clubs, club_members, tags, problems
- problem_tags, problem_test_cases, contests, contest_problems
- contest_registrations, submissions, submission_cases
- sandbox_runs, user_scores, user_problem_status
- tab_switch_logs, home_daily_problem_config, home_carousel_slides
- practices, practice_problems, contest_audiences, contest_problem_case_scores

---

## 验证清单

### 索引创建验证

```sql
-- 验证 submissions 表索引
SHOW INDEX FROM submissions WHERE Key_name IN (
  'idx_user_status_time',
  'idx_problem_status', 
  'idx_submissions_created_at'
);

-- 验证 problems 表索引
SHOW INDEX FROM problems WHERE Key_name IN (
  'idx_problems_public_deleted',
  'idx_problems_deleted_public_difficulty'
);

-- 验证 contests 表索引
SHOW INDEX FROM contests WHERE Key_name IN (
  'idx_contests_deleted_status_time',
  'idx_contests_time_range'
);

-- 验证 user_scores 表索引
SHOW INDEX FROM user_scores WHERE Key_name = 'idx_user_scores_ranking';
```

### 索引使用验证

```sql
-- 测试1: submissions 用户历史查询
EXPLAIN SELECT * FROM submissions 
WHERE user_id = 1 AND status = 'AC' 
ORDER BY created_at DESC LIMIT 50;
-- 期望: key=idx_user_status_time

-- 测试2: problems 公开题目列表
EXPLAIN SELECT * FROM problems 
WHERE is_deleted = FALSE AND is_public = TRUE 
ORDER BY difficulty LIMIT 50;
-- 期望: key=idx_problems_deleted_public_difficulty

-- 测试3: user_scores 排行榜
EXPLAIN SELECT * FROM user_scores 
ORDER BY rating DESC, ac_count DESC LIMIT 100;
-- 期望: key=idx_user_scores_ranking
```

### 性能对比测试

```sql
-- 测试前：记录查询时间
SET profiling = 1;

-- 执行关键查询
SELECT * FROM submissions 
WHERE user_id = 1 AND status = 'AC' 
ORDER BY created_at DESC LIMIT 50;

-- 查看性能
SHOW PROFILES;
```

---

## 回滚脚本

如需回滚V20变更：

```sql
-- 删除新增的索引
DROP INDEX idx_user_status_time ON submissions;
DROP INDEX idx_problem_status ON submissions;
DROP INDEX idx_submissions_created_at ON submissions;
DROP INDEX idx_contest_registrations_user ON contest_registrations;
DROP INDEX idx_user_best_status ON user_problem_status;
DROP INDEX idx_problems_public_deleted ON problems;
DROP INDEX idx_problems_deleted_public_difficulty ON problems;
DROP INDEX idx_contests_deleted_status_time ON contests;
DROP INDEX idx_contests_time_range ON contests;
DROP INDEX idx_practices_deleted_published ON practices;
DROP INDEX idx_participants_registered_at ON contest_participants;
DROP INDEX idx_user_scores_ranking ON user_scores;
DROP INDEX idx_class_members_class ON class_members;
DROP INDEX idx_club_members_club ON club_members;

-- 恢复被删除的单列索引
CREATE INDEX idx_problems_is_deleted ON problems(is_deleted);
CREATE INDEX idx_contests_is_deleted ON contests(is_deleted);
CREATE INDEX idx_practices_is_deleted ON practices(is_deleted);

-- 删除外键约束
ALTER TABLE submissions DROP FOREIGN KEY fk_submissions_participant;

-- 删除唯一约束
ALTER TABLE home_daily_problem_config DROP INDEX uk_daily_problem_singleton;
ALTER TABLE practice_problems DROP INDEX uk_practice_display_order;
```

---

**文档版本**: 1.0  
**生成时间**: 2026-06-13  
**对应迁移**: V20__optimize_database_schema.sql
