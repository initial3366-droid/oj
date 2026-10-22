# 渐进式重构第 2 批：提交列表、导出与测试点统计（A02、A03）

日期：2026-10-13。依据：[阶段一审计](/Users/initial/qoj/docs/java-quality-audit-2026-10-13.md)。本批仅处理提交展示链路，不代表整个项目重构完成。

## 问题、证据及实际修改

`SubmissionService.list/adminList/adminExportList` 原先逐条转换 VO；`toVO/toAdminVO` 每条执行两次测试点 COUNT，再逐条查询用户、题目及比赛/练习关联。公开列表在提交资源统计缺失时，`maxCaseTimeMs(Long)` 和 `maxCaseMemoryKb(Long)` 分别读取相同测试点明细。详情已经读取测试点，仍另做两次 COUNT。

旧实现真实 HTTP 基线证明：20 条普通提交的管理列表执行 83 条 SQL，其中 40 条是测试点计数；28 条混合提交的列表执行 128 条，导出执行 127 条。原始 SQL、完整响应均保存在前后 E2E 报告，见下方证据链接。

本批生产文件共 3 个：

- [SubmissionService.java](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java)：分页或导出查询后，收集去重 ID，使用现有 Mapper 和 QueryWrapper 批量读取展示所需关联列；局部请求上下文供 VO 转换复用。空结果不执行关联查询。公开列表和管理列表仍保留各自标题来源、空白值及缺失关联兜底逻辑。
- [SubmissionCaseResultMapper.java](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/mapper/SubmissionCaseResultMapper.java)：增加按 submission_id 分组的 COUNT、AC 条件计数、正数耗时/内存 MAX 查询。统计继续由数据库比较 status，保留当前 MySQL 排序规则下小写 ac 的匹配语义。
- [SubmissionCaseSummary.java](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/mapper/SubmissionCaseSummary.java)：用于接收上述 5 列 SQL 投影的 record，不加载测试输出或 judge_message。

删除 4 个重复资源最大值方法，删除两个转换入口中重复的逐条 COUNT 及关联读取，复用 JDK 集合和既有 MyBatis 能力。公开详情在同一次遍历中计算两项资源兜底，且仍以本次返回的测试点为依据；管理详情仍保留原始提交资源值。未增加依赖、跨请求缓存或数据库结构变更；原有权限过滤、封榜、PENDING 遮罩和事务注解保持原样。

详情保留一次数据库聚合加一次排序明细查询，共 2 次测试点查询；没有直接用 Java 比较状态来计数，因为那会改变数据库的大小写比较语义。因此 A03 的详情两次 COUNT 合并为一次聚合，而非宣称详情完全没有统计查询。

工作区原本已有大量改动。本批以修改前快照为基线，保存独立可审查差异：[Service patch](/Users/initial/qoj/output/java-quality-refactor-02/submission-service.patch)、[Mapper patch](/Users/initial/qoj/output/java-quality-refactor-02/submission-case-mapper.patch)、[新增投影 patch](/Users/initial/qoj/output/java-quality-refactor-02/submission-case-summary.patch)。未提交 Git commit，未覆盖其他原有改动。

## 实测对比

通过生产可执行 Spring Boot jar、真实 Security/MVC/MyBatis/JDBC/MySQL 和独立 Redis 容器发起 HTTP 请求。统计 MyBatis Preparing 日志中的 HTTP 请求线程 SQL，包含认证、配置、权限查询；排除调度线程。每次请求顺序执行，前后使用相同固定业务数据。

| 请求场景 | 全链路 SQL 前→后 | 测试点 SQL 前→后 |
| --- | ---: | ---: |
| 管理普通列表，20 条 | 83→6 | 40→1 |
| 公开普通列表，11 条 | 64→7 | 38→1 |
| 管理混合列表，28 条 | 128→9 | 56→1 |
| 教师班级隔离列表 | 73→10 | 30→1 |
| 冻结比赛公开列表 | 10→9 | 2→1 |
| 冻结比赛本人例外 | 10→9 | 2→1 |
| 冻结比赛管理员例外 | 15→9 | 4→1 |
| 比赛隐藏他人状态 | 27→9 | 10→1 |
| 公开详情 | 8→7 | 3→2 |
| 管理详情 | 7→6 | 3→2 |
| 空页 | 2→2 | 0→0 |
| 混合提交 CSV 导出，28 条 | 127→8 | 56→1 |

普通管理列表全链路 SQL 减少约 92.8%，混合导出减少约 93.7%。列表测试点查询不再随提交条数线性增加，且不会读取测试点消息明细。以上是查询次数收益，不是延迟或吞吐量提升比例。

## 验证与可复跑证据

修改代码前先列出[失败场景](/Users/initial/qoj/docs/submission-batch-read-failure-cases.md)，编写 [HTTP E2E](/Users/initial/qoj/tools/e2e/submission-batch-read.mjs)，运行旧实现取得基线后才修改生产代码；未新增或修改单元测试。

- 修改前 `mvn test`、`mvn package` 通过；最终修改后 `mvn package` 通过，177 项既有测试，0 失败、0 错误、0 跳过。
- 最终 E2E 15 项综合检查全部通过：12 个请求场景、权限检查、业务表校验和不变，以及全量响应快照/CSV 字节前后对照。测试包括无测试点、资源 null/0/负数、混合状态 AC/ac/ACCEPTED、缺失关联、公开动态标题与管理快照标题、空白标题、测试点排序、代码暴露边界。
- 未登录管理请求仍 401，学生管理请求仍 403，教师访问班级外提交详情仍 403；封榜本人/管理员例外及他人状态遮罩通过。
- `node --check` 和生产文件 `git diff --check` 通过。没有删测试、跳过检查或放宽业务断言。
- 使用随机命名临时 MySQL schema，仅从现有数据库复制表结构；测试数据自行创建。自己的 Redis 容器、后端进程及临时数据库在前后两轮均确认清理。

证据：

- [旧实现报告、响应、SQL](/Users/initial/qoj/output/submission-batch-read-e2e/before/report.json)
- [最终实现报告、响应、SQL](/Users/initial/qoj/output/submission-batch-read-e2e/after/report.json)
- [量化对照、清理结果、生产源文件哈希](/Users/initial/qoj/output/java-quality-refactor-02/comparison.json)
- [重构前构建日志](/Users/initial/qoj/output/java-quality-refactor-02/before-build.log)、[最终构建日志](/Users/initial/qoj/output/java-quality-refactor-02/after-build.log)
- [最终 CSV](/Users/initial/qoj/output/submission-batch-read-e2e/after/submissions.csv)

从仓库根目录复跑当前实现：

```sh
(cd backend && mvn package)
node tools/e2e/submission-batch-read.mjs after
```

需要 Docker、Java、项目 `.env` 及当前 qoj-mysql/qoj-redis 容器。脚本固定使用 submission-audit 管理 API 前缀；after 模式要求保留 before 报告用于等价比较。before 模式应搭配旧实现 jar，不能用当前 jar 覆盖基线。

## 限制与仍需处理的风险

未验证 p95、并发压测、10,000 条导出上限的查询计划和内存；临时 schema 使用当前表结构并关闭 Flyway，没有验证全量迁移。本批未增加事务隔离或一致性承诺，批量读取会减少逐条查询之间的时间间隔，但没有对并发重判、删除关联的所有交错进行证明。原有构建弃用/JVM agent 警告仍存在。

E2E 准备期间另发现：公开比赛列表隐藏状态逻辑的 `isOwner` 只比较 `ownerId` 与当前账号 ID，未比较账号类型。独立账号表 ID 相同时，学生可能被当作管理员创建比赛的所有者。初始遮罩场景因此失败；换用 ID 不碰撞的普通学生后验证既有正常遮罩行为。该问题存在于旧实现，属于权限正确性风险，本批未更改；需要单独增加账号类型碰撞场景并修复权限逻辑，不能把本批权限回归通过理解为整个权限系统安全证明。

其他审计项仍按原报告待处理；本批仅解决上述提交展示链路，未修改判题、远程请求或其他模块的 N+1。
