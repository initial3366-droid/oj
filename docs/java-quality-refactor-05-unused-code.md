# 第五批重构：删除无用代码与排名无效查询

对应 [全量审计 S01–S06](/Users/initial/qoj/docs/java-static-audit-2026-10-13.md)。基于执行前工作区快照，只修改已核对的局部冗余；没有更改外部请求/响应、数据库结构、权限规则或项目依赖。

## 完成内容及证据

| 项目 | 修改前 | 修改后 | 说明 |
| --- | ---: | ---: | --- |
| 全后端 PMD 无用 import | 29 | 0 | 删除原清单 29 处，另删除依赖清理产生的 10 个 import，共 39 个 |
| 无静态调用私有方法 | 15 | 0 | 删除生产 14、测试 1 个；复扫后再删除级联失去调用的 identityKey(IdentityType, Long)，共 16 个 |
| 未读取的注入字段 | 原清单 7 个 | 0 | 同步删除构造参数；另删除两套排名服务的 UserMapper，共移除 9 个假依赖 |
| StandingAccumulator | 1 个内部类、8 个字段 | 删除 | 仅被无调用的 emptyStanding 使用 |
| 未使用私有参数 | 6 | 2 | 删除 fullScore、requestedId、contestId、finishAt，保留请求 DTO 字段 |
| 无用局部变量告警 | 5 | 2 | 两个排名 user 删除，addedProblems 改为仅调用验证方法；剩余两个 permit 是必要的资源释放句柄 |
| 无用赋值告警 | 1 | 0 | 删除提交方法中会被覆盖的 null 初始化 |
| javac 全量告警 | 165 | 159 | 相同 Java 17 目标和 Xlint 参数；未用 SuppressWarnings 隐藏结果 |

清理共涉及 **21 个生产 Java 文件、2 个测试文件，净删除 253 行 Java**。测试仅清理无用 import、死辅助方法，以及适配 SystemSettingService 的显式构造；没有新增单元测试、删除测试用例或修改断言。未新增工具类或依赖，沿用现有 Mapper、排名缓存及参赛者数据。

### 排名查询

ContestAcmRankService.getRankList 和 ContestOiRankService.getRankList 原先收集参赛者 userId、查询 users，再把结果写入未读取的 User user。榜单字段实际来自参赛者、排名缓存及题目状态。

整段删除 ID 收集、用户 Map、查询及 UserMapper 注入，没有只删除局部变量而留下数据库访问。

真实 HTTP 请求线程的 MyBatis SQL 日志对比：

| 场景（两种赛制均验证） | 修改前 | 修改后 |
| --- | ---: | ---: |
| 匿名、非空榜单 | 8 | 7 |
| 学生/管理员、非空榜单 | 9 | 8 |
| 匿名、空榜单 | 4 | 4 |
| 学生/管理员、空榜单 | 5 | 5 |
| 匿名、无效赛制/不存在比赛 | 3 | 3 |
| 学生/管理员、无效赛制/不存在比赛 | 4 | 4 |

SQL 数包含现有请求链路基础查询；不是只统计 Service 内部。全部 12 个非空请求严格断言仅少一条 `users WHERE id IN` 查询，其他 SQL 顺序与内容一致；24 个场景完整 HTTP 状态及 JSON 相同。每次运行还校验读取前后相关业务表未发生写入。没有更改事务声明、排序、积分或处罚计算。

## 验证结果

- 修改前 `mvn test`：177 项全部通过。
- 修改前隔离源码 `mvn package` 与最终工作区 `mvn package`：均成功，177 项测试，0 失败/错误/跳过。
- 全部 489 个 Java 文件以 `javac --release 17 -Xlint:all -Xmaxwarns 10000` 编译成功。
- PMD 7.28.0 使用原 51 条规则复扫成功，无解析或规则处理错误；上述 unused 指标已核对。
- 新排名 E2E：修改前/后各 24 个 HTTP 场景，全部通过。
- 既有 ZIP/连续训练 E2E：7 组检查通过，含 ZIP 边界、异常和权限、10 种日期场景。
- 既有提交 E2E：15 组检查通过。
- 既有设置 E2E：7 组检查通过。
- `git diff --check`：通过。

E2E 均使用真实 Spring/Security/MVC/MyBatis、临时 MySQL schema 和独立 Redis；各报告确认后端停止、临时数据库及 Redis 删除。没有修改线上数据。

新增排名 E2E 首次两次运行因夹具遗漏 contest_problems 的必填 title/statement 列失败，尚未发出业务请求。依据实际 schema 补齐 title、statement、time_limit、memory_limit 后重跑；保留失败报告，没有跳过数据库约束或放宽断言。

## 可审查 diff 与可重复产物

原工作区已有大量改动，本批未暂存、提交或回退这些内容。按执行前快照生成四份连续应用的独立补丁：

1. [排名无效查询](/Users/initial/qoj/output/java-quality-refactor-05/01-unused-rank-query.patch)
2. [无用 import 与注入依赖](/Users/initial/qoj/output/java-quality-refactor-05/02-unused-imports-dependencies.patch)
3. [私有死代码、内部类与局部变量](/Users/initial/qoj/output/java-quality-refactor-05/03-private-dead-code.patch)
4. [无用私有参数](/Users/initial/qoj/output/java-quality-refactor-05/04-unused-private-parameters.patch)

[本批完整补丁](/Users/initial/qoj/output/java-quality-refactor-05/complete.patch)与[逐文件修改清单](/Users/initial/qoj/output/java-quality-refactor-05/changed-files.json)独立于此前改动；Java 快照保存在同目录 before/after。

- [排名基线](/Users/initial/qoj/output/unused-rank-cleanup-e2e/before/report.json)、[排名修改后](/Users/initial/qoj/output/unused-rank-cleanup-e2e/after/report.json)
- [ZIP/连续训练](/Users/initial/qoj/output/java-quality-refactor-05/zip-streak-report.json)、[提交](/Users/initial/qoj/output/java-quality-refactor-05/submission-report.json)、[设置](/Users/initial/qoj/output/java-quality-refactor-05/settings-report.json)
- [构建及 177 项测试日志](/Users/initial/qoj/output/java-quality-refactor-05/qoj-cleanup-final-package.log)
- [PMD 全量修改后报告](/Users/initial/qoj/output/java-quality-refactor-05/pmd-after.xml)、[编译告警](/Users/initial/qoj/output/java-quality-refactor-05/javac-after.log)
- [修改前失败场景说明](/Users/initial/qoj/docs/unused-code-cleanup-failure-cases.md)、[排名 E2E 脚本](/Users/initial/qoj/tools/e2e/unused-rank-cleanup.mjs)

复现：在 backend 中运行 `mvn package`，仓库根目录运行 `node tools/e2e/unused-rank-cleanup.mjs after`。修改前源码与 jar 单独保留在 `output/java-quality-refactor-05/baseline-backend`，可用 `QOJ_E2E_BACKEND_JAR=output/java-quality-refactor-05/baseline-backend/target/qoj-backend-0.1.0.jar node tools/e2e/unused-rank-cleanup.mjs before` 重建 HTTP 基线。公共 E2E 启动器只增加可选 jar 路径覆盖，默认行为保持一致。

## 保留事项与验证边界

- `weekAcCount(userId)` 恒定返回 0，需明确周统计口径后单独修复；本批没有创造新积分行为。
- `identityName(String type, Long id)` 的 type 未参与计算，涉及旧身份表示与调用方的 type.name() 求值；暂不借机械清理改变其异常/身份语义。
- 两个 try-with-resources 的 permit 必须保留，否则会破坏并发额度释放。
- Spring/Jackson/MyBatis 的公共字段、框架入口、starter 和反射类型未按“无 Java 调用”删除。
- S07 复杂业务方法、S08 Locale、S09 泛型/弃用/序列化告警及重复片段继续保留原审计结论；需要各自的输入、权限、异常与副作用回归，未把工具告警统一机械修复。
- 本批未新增多线程压力测试、远程服务故障注入或耗时基准；只量化实际减少的查询，未声称已证明并发正确性或整体吞吐提升。
