# 今日 AC 提交数：修改前失败场景

- submit_time 为今天、created_at 非今天时，首页漏计列表中的今日提交。
- submit_time 非今天、created_at 为今天时，首页错误计入今天。
- 同人同题重复 AC 被按人数或题目去重。
- 比赛 AC 被排除，只统计普通练习。
- WA、等待判题等被计入 AC。
- 当天零点未计入、次日零点被计入。
- 老记录 submit_time 为空时完全丢失，应该回退 created_at。
- ACCEPTED 历史状态被漏计（系统其他通过统计已经支持 AC/ACCEPTED）。

验证脚本从实际 Java 代码提取 SQL，以 SQLite 内存表校验日期和计数语义，输出可复现报告。该检查不验证线上 MySQL 的实际记录，不能单凭本地通过断言线上问题已解决。

## 线上接口发现的查询路径差异

用户提供的同一次 dashboard 响应：todayAcceptedCount=1，而 submissionTrend 中 10-07 accepted=5、total=8，todaySubmissionCount=8。说明首页 AC 与趋势的统计不一致。

实施前补充失败场景：

- JdbcTemplate 将 LocalDateTime 参数作为 JDBC Timestamp 传递，而 MyBatis 使用 LocalDateTime 类型处理器；两种时间绑定方式与数据库连接时区可能产生不同的日期范围。
- 卡片查询继续使用 JdbcTemplate，无法与 MyBatis 查询的时间参数行为保持一致。
- 仅修改前端展示数字，掩盖后端查询不一致。

本次让今日提交和今日 AC 卡片直接复用 SubmissionMapper 返回的同一份逐日聚合，与趋势共用一次查询结果；按 submit_time 优先、created_at 回退统计，不做去重。以上为已发现的查询路径差异与待验证原因；没有线上数据库访问权限，不能宣称已确认 JDBC 时区就是根因。
