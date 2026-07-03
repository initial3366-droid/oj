# QOJ 数据库架构审查报告

## 审查范围
- 19个Flyway迁移脚本（V1-V19）
- 核心表：users, problems, contests, submissions, practices等
- 关系表：contest_problems, contest_registrations, user_problem_status等
- 缓存表：user_scores, contest_acm_rank_cache, contest_oi_rank_cache等

## 发现的问题

### CRITICAL 优先级

#### 1. 缺失复合索引导致性能问题
**影响**: 严重影响查询性能

- `submissions` 表缺少 `(user_id, status, created_at)` 索引（用户提交历史查询）
- `submissions` 表缺少 `(problem_id, status)` 索引（题目AC率统计）
- `contest_registrations` 表缺少 `(user_id, contest_id)` 索引（用户报名历史）
- `user_problem_status` 表缺少 `(user_id, best_status)` 索引（用户AC题目列表）
- `problems` 表缺少 `(is_public, is_deleted)` 索引（公开题目列表）

#### 2. 外键约束缺失
**影响**: 数据完整性风险

- `contests.owner_id` 可能引用 `users.id` 或 `admin_users.id`，但无外键约束
- `practices.audience_id` 引用 class/club 但无外键
- `contests.audience_id` 引用 class/club 但无外键
- `contest_audiences.audience_id` 引用不明确
- `submissions.participant_id` 缺少外键到 `contest_participants`

#### 3. 字段命名不一致
**影响**: 代码混乱，维护困难

- 时间字段：`created_at` vs `run_at` (sandbox_runs)
- 身份字段：`identity_type/identity_id` vs `audience/audience_id`
- 删除标记：`is_deleted` (新增) vs 没有软删除 (旧表)

### HIGH 优先级

#### 4. 软删除索引不完整
**影响**: 软删除查询性能差

- `problems` 有 `idx_problems_is_deleted`，但应该是 `(is_deleted, is_public)` 复合索引
- `contests` 有 `idx_contests_is_deleted`，但应该是 `(is_deleted, status, start_time)` 复合索引
- `practices` 有 `idx_practices_is_deleted`，但应该是 `(is_deleted, published)` 复合索引

#### 5. JSON字段缺少虚拟列和索引
**影响**: JSON字段查询性能差

- `problems.tags` (JSON) 无法高效查询
- `problems.sample_cases` (JSON) 无法高效查询
- `tab_switch_logs.log_detail` (JSON) 无法高效查询

#### 6. 冗余字段
**影响**: 存储浪费，维护成本

- `contests.audience` + `contests.audience_id` vs `contest_audiences` 表重复
- `submissions.identity_type/identity_id` vs `participant_id` 重复
- `submissions.submit_time` vs `submissions.created_at` 重复
- `contest_problems.score` 语义不明确（ACM不用分数，OI用full_score）

#### 7. 数据类型不合理
**影响**: 存储效率低，潜在溢出风险

- `users.student_no` VARCHAR(80) 过长，学号通常20字符足够
- `contests.type` VARCHAR(16) 应该用 ENUM
- `contests.status` VARCHAR(16) 应该用 ENUM
- `submissions.status` VARCHAR(40) 应该用 ENUM
- `submissions.language` VARCHAR(40) 应该用 VARCHAR(20)

### MEDIUM 优先级

#### 8. 缺少时间范围查询索引
**影响**: 按时间查询性能差

- `submissions` 缺少 `(created_at)` 索引
- `contests` 缺少 `(start_time, end_time)` 复合索引
- `contest_participants` 缺少 `(registered_at)` 索引

#### 9. 未使用或废弃字段
**影响**: 表臃肿

- `problems.domjudge_problem_id` 很少使用
- `submissions.domjudge_submission_id` 很少使用
- `contest_problems.domjudge_problem_id` 快照后不应该有
- `contests.frozen` vs `contests.freeze_time` 语义重叠
- `contests.duration_minutes` 可以从 start_time/end_time 计算

#### 10. 缺少唯一约束
**影响**: 可能插入重复数据

- `home_daily_problem_config` 应该只有一条记录，但没有唯一约束
- `contest_problem_case_scores` 主键应该是 (contest_id, problem_id, case_no)
- `practice_problems` 缺少 `(practice_id, display_order)` 唯一约束

### LOW 优先级

#### 11. 字段长度不统一
**影响**: 不影响功能，但不规范

- `users.display_name` VARCHAR(80) vs `contest_participants.nickname` VARCHAR(100)
- `classes.name` VARCHAR(120) vs `clubs.name` VARCHAR(120) vs `tags.name` VARCHAR(80)

#### 12. 表注释缺失
**影响**: 可维护性差

- 大部分旧表（V1创建的）没有表注释
- 只有V15创建的表有详细注释

#### 13. 缺少审计字段
**影响**: 无法追踪修改人

- 核心表缺少 `created_by`, `updated_by` 字段
- 只有 `home_daily_problem_config` 有 `updated_by`

## 总结统计

- 发现问题总数: **13类**
- CRITICAL: **3类**
- HIGH: **4类**
- MEDIUM: **3类**
- LOW: **3类**

## 优化建议优先级

1. **立即修复**: 缺失索引（CRITICAL #1）
2. **短期修复**: 软删除索引优化（HIGH #4）、外键约束（CRITICAL #2，需谨慎）
3. **中期优化**: 数据类型调整（HIGH #7）、冗余字段清理（HIGH #6）
4. **长期重构**: 字段命名标准化（CRITICAL #3）、JSON字段优化（HIGH #5）
