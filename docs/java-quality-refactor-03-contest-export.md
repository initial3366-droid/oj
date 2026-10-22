# 渐进式重构第 3 批：比赛提交 ZIP 用户批量读取（A09）

日期：2026-10-13。依据：[阶段一审计 A09](/Users/initial/qoj/docs/java-quality-audit-2026-10-13.md)。本批仅修改比赛提交 ZIP 的用户读取，不代表其他审计项完成。

## 已确认问题与实际修改

`ContestInspectionExportService.submissionsZip` 对相同提交集合先生成 `submissions.csv`，再生成每份代码的路径。`submissionsCsvText` 与 `codeEntryName` 原先分别逐条 `userMapper.selectById`；N 条非空 userId 的提交触发 2N 次查询。真实 HTTP 基线证实，20 条同用户提交在这两处产生 40 次用户 SQL，并未被 MyBatis 缓存吸收。

生产代码只修改 [ContestInspectionExportService.java](/Users/initial/qoj/backend/src/main/java/com/qoj/module/contest/service/ContestInspectionExportService.java)：收集去重非空 userId，一次查询 id/username/display_name 三列，供 CSV 与代码路径共同使用。组织方式沿用同文件 `registrationUsersCsv` 的 LinkedHashSet、Map 和既有 Mapper 模式。空集合不查询；两个格式化方法只读取传入的数据。

删除两处循环内用户查询；不增加工具类、接口、依赖或缓存。没有修改路径清洗、扩展名选择、CSV 转义、BOM、提交排序、榜单算法、权限判断、审计日志内容、事务和数据库结构。其余导出接口未修改。

当前工作区已有其他批次及用户改动。本批保存了开始时的文件快照及独立 [contest-export.patch](/Users/initial/qoj/output/java-quality-refactor-03/contest-export.patch)，未创建 Git commit。

## 实测量化收益

真实可执行 Spring Boot jar，通过完整认证/MVC/Service/MyBatis/JDBC 访问 MySQL。SQL 计数来自 HTTP 线程的 MyBatis Preparing 日志，排除后台调度线程。

| 场景 | 全链路 SQL 前→后 | 全链路用户 SQL 前→后 | ZIP 条目数 |
| --- | ---: | ---: | ---: |
| 同一用户 20 次提交 | 70→31 | 61→22 | 22 |
| 空比赛 | 8→8 | 0→0 | 2 |
| 8 次提交，重复/缺失/空用户名用户 | 47→32 | 25→10 | 10 |
| 更新用户名后再次导出 20 次提交 | 70→31 | 61→22 | 22 |

20 条提交的两轮用户读取由 40→1，8 条由 16→1；全链路 SQL 分别减少 39 和 15，实测与预期完全相符。全链路仍有榜单构建内部的用户查询，所以不能宣称完整导出只剩一次用户查询。减少 SQL 次数不等同于同比例降低接口延迟。

## 验证结果与证据

遵循项目要求，修改生产代码前先编写[失败场景](/Users/initial/qoj/docs/contest-export-batch-read-failure-cases.md)和 [HTTP E2E 脚本](/Users/initial/qoj/tools/e2e/contest-export-batch-read.mjs)，运行旧实现得到绿色基线。没有新增或修改单元测试。

- 修改前 `mvn test`、`mvn package` 通过；修改后 `mvn package` 通过，177 项现有测试，0 失败、0 错误、0 跳过。
- 最终 E2E 6 项综合检查通过：4 个导出数据场景、权限场景、前后逐项内容及 SQL 对照。覆盖 ZIP 可完整解压/CRC、条目名称与顺序、代码字节、两个 CSV 的 UTF-8 BOM、逗号/双引号/换行转义、中文、缺失用户、空用户名、缺失比赛题目/原题回退、空代码、代码长度与提交时间兜底、各语言扩展名。
- 对照的是所有 ZIP 条目名称、顺序及解压后字节；ZIP 自带生成时间戳，未要求压缩包原始字节相等。四个导出场景的全部条目一致。
- 连续请求间更新用户名后，CSV 与路径立即同步变化；成功导出仍记录 view_code 安全审计日志。每次请求前后业务表 CHECKSUM 不变。
- 未登录仍 401，学生及非所有者 CONTENT_ADMIN 仍 403，不存在比赛仍 404；拒绝请求没有执行 submissions 查询。
- 测试只从现有数据库复制表结构，在随机命名临时 schema 写入自建数据，使用独立 Redis 容器。前后两次均确认后端停止、Redis 删除、临时数据库删除。
- E2E 脚本语法及生产代码 `git diff --check` 通过。

测试准备曾因当前 schema 的 code NOT NULL 约束和审计 permission 字符串实际为小写而失败；调整为合法空代码及实际日志格式后重新取得绿色旧实现基线，再修改生产代码。旧实现的语言扩展名顺序也由源码与解压结果核实，没有修改生产行为来迎合预期。

证据文件：

- [旧实现 E2E 响应与 SQL](/Users/initial/qoj/output/contest-export-batch-read-e2e/before/report.json)
- [最终实现 E2E 响应与 SQL](/Users/initial/qoj/output/contest-export-batch-read-e2e/after/report.json)
- [量化对照及清理结果](/Users/initial/qoj/output/java-quality-refactor-03/comparison.json)
- [重构前构建日志](/Users/initial/qoj/output/java-quality-refactor-03/before-build.log)、[重构后构建日志](/Users/initial/qoj/output/java-quality-refactor-03/after-build.log)
- [重复用户 ZIP](/Users/initial/qoj/output/contest-export-batch-read-e2e/after/repeated-users.zip)、[混合数据 ZIP](/Users/initial/qoj/output/contest-export-batch-read-e2e/after/mixed-users.zip)、[空比赛 ZIP](/Users/initial/qoj/output/contest-export-batch-read-e2e/after/empty-contest.zip)

从仓库根目录复跑当前实现：

```sh
(cd backend && mvn package)
node tools/e2e/contest-export-batch-read.mjs after
```

需要 Docker、Java、Python 3、项目 `.env` 和现有 qoj-mysql/qoj-redis 容器。Python 只使用标准库解析 ZIP。after 模式必须保留 before 报告；before 模式只能使用旧实现 jar，避免覆盖基线。脚本使用自己的 export-audit 管理 API 前缀。

## 限制与剩余风险

未做大规模导出、p95、内存或并发更名压测；原有导出会把完整 ZIP 放在内存，本批未改变。用户批量 IN 的大集合查询计划和数据库包大小限制尚未验证。读取范围仅当前请求，没有增加缓存过期窗口；但多条查询之间不保证并发事务快照一致性，也没有新增事务承诺。

测试 schema 关闭 Flyway，无数据库迁移改动，未重跑迁移链。当前数据库禁止 null code，所以实际验证的是空代码；源码保留 null 代码兜底。缺失关联通过临时 schema 中关闭会话外键校验构造，没有修改原业务库约束。

既有 `extension` 先检查字符串包含 java，再检查 javascript，因此 JavaScript 代码条目实际使用 `.java`。本批以旧实现为基线保留并验证该行为，需要单独正确性修复。ZIP 榜单构建仍存在逐条用户查询，已在真实计数中体现，适合后续独立取数重构。

第 2 批记录的比赛列表账号类型 ID 碰撞权限风险仍待独立修复；本批不改变权限语义。下一组按审计优先级处理排行榜取数 A05/A06，并需先验证角色筛选、班级回退、同分顺序与训练连续日期。
