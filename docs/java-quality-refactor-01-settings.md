# 渐进式重构第 1 批：固定配置批量读取（A07）

日期：2026-10-13。阶段一依据：[审计报告](/Users/initial/qoj/docs/java-quality-audit-2026-10-13.md)。本批只修改一组相关问题，尚未完成报告中其他重构项。

## 实际修改

生产代码仅修改 [SystemSettingService.java](/Users/initial/qoj/backend/src/main/java/com/qoj/module/setting/service/SystemSettingService.java)：

- getFrontendSettings 用已有 SystemSettingMapper.selectBatchIds 一次读取固定的 10 个键；getJudgeRuntimeSettings 一次读取固定的 7 个键。
- 两处复用同一个私有 readSettings 方法；使用 JDK List/Map，未新增工具类、接口、框架或依赖。
- 删除不再需要的 boolSetting、textSetting、positiveLongSetting；positiveIntValue 复用既有 intValue/default 解析，保留其他单键读取入口所需的 positiveIntSetting。
- 保留前端与判题配置各自原有布尔语义（例如 judge.enabled 空字符串默认 true，而带空格的 ` true ` 仍被 Boolean.parseBoolean 判为 false）；正整数、正长整数的容错及默认值不变。
- 没有修改 Controller、外部响应、权限、调度频率、事务注解、数据库结构；没有增加跨请求缓存。

当前工作区原本已有大量改动。因此除通常的 Git diff 外，另外保存了**仅本批产生的生产代码差异**：[settings.patch](/Users/initial/qoj/output/java-quality-refactor-01/settings.patch)，其基线是本轮开始时的文件快照，避免把原有改动误计为本批重构。

## 实测查询次数与输出等价

使用真实可执行 Spring Boot 应用、生产 Security/MVC/Service/Mapper、真实 MySQL 和独立 Redis 容器，通过 HTTP 测量。计数来自 JDBC 准备 SQL 时输出的 MyBatis Preparing 日志，仅统计 HTTP 请求线程的 system_settings 查询，排除后台调度线程；不是 Mockito 或 Mapper 调用次数。

| 请求 | 重构前配置 SELECT | 重构后配置 SELECT | 减少 |
| --- | ---: | ---: | ---: |
| 管理端前端配置 | 10 | 1 | 90% |
| 管理端判题配置 | 7 | 1 | 约 85.7% |
| 公开前端配置（维护模式关闭） | 20 | 2 | 90% |

公开接口的 20→2 是动态验证补充发现：MaintenanceModeInterceptor 和 Controller 各读取一次前端配置。阶段一的 10→1 描述的是单次 Service 调用，不是完整公开请求链。本批保留两次读取及原有维护拦截语义，没有添加请求缓存或绕过拦截器。

共 5 组数据场景、14 组前后 SQL 测量与响应快照对照：全部缺键、完整有效配置、非法/溢出/非正数、部分键与空白、int/long 上界。所有响应一致；数据库配置行及更新时间/更新人未被读取操作修改；连续请求间修改配置立即可见。Long.MAX_VALUE 另以原始响应文本验证，避免 JavaScript 精度丢失掩盖问题。

其他验证包括：维护模式开启仍返回 503，maintenance-mode 接口仍可读取；公开判题接口仍仅暴露 enabled/enableSandbox；管理配置未登录 401、普通学生 403、超级管理员正常读取。未修改任何既有单元测试。

## 验证结果与证据

- 修改前 `mvn test` 通过；构建旧实现 `mvn package` 通过，177 项测试，0 失败/错误/跳过。
- 修改前先写 [失败场景](/Users/initial/qoj/docs/settings-batch-read-failure-cases.md) 与 [HTTP E2E 脚本](/Users/initial/qoj/tools/e2e/settings-batch-read.mjs)，旧实现通过基线后才修改生产代码。
- 修改后 `mvn package` 通过，177 项既有测试全部通过；同一 E2E 的 7 项综合检查通过，包括前后响应对照。
- `git diff --check` 和 E2E 脚本语法检查通过。
- E2E 期间先修正了日志采集器对缩写 logger 名称的假设、公开请求漏计维护拦截器的问题，以及测试 SQL 中空字符串字面量的生成错误；之后重新取得绿色基线。没有跳过断言或删除场景。
- 测试使用随机命名的独立 MySQL schema，只从业务数据库读取表结构，不复制业务数据；使用自己的 Redis 容器。前后两次测试都确认后端停止、Redis 容器删除、临时数据库删除。

证据：

- [重构前 E2E 报告及 SQL](/Users/initial/qoj/output/settings-batch-read-e2e/before/report.json)
- [重构后 E2E 报告及 SQL](/Users/initial/qoj/output/settings-batch-read-e2e/after/report.json)
- [前后量化对照](/Users/initial/qoj/output/java-quality-refactor-01/comparison.json)
- [重构前构建日志](/Users/initial/qoj/output/java-quality-refactor-01/before-build.log)
- [重构后构建日志](/Users/initial/qoj/output/java-quality-refactor-01/after-build.log)

复跑当前实现（从仓库根目录）：

```sh
(cd backend && mvn package)
node tools/e2e/settings-batch-read.mjs after
```

`before` 模式要求旧实现构建的 jar，当前 jar 不应以 before 模式运行。脚本 after 模式若找到旧报告，会额外核对旧响应快照。运行环境需具备 Docker、当前 qoj-mysql、qoj-redis 的本地镜像、Java 与项目 .env。测试固定将管理 API 前缀设为 settings-audit，不依赖真实后台前缀。

## 限制与剩余事项

本次证明的是固定数据及顺序更新下的响应/副作用等价和实际查询次数减少，不是 p95、CPU、并发压力或端到端延迟的收益证明。新增测试临时 schema 使用当前数据库的表结构，关闭 Flyway；本批不改 schema，未重跑全部迁移。现有弃用 API/ProblemVO 及 JVM 动态 agent 警告未屏蔽。

一条 IN 查询返回同一查询快照；对跨字段并发写入未做交错压测，不增加原来没有的事务或一致性承诺。判题配置每次仍从数据库读取，所以未引入配置过期窗口。

审计项 A01–A06、A08–A18 尚未在本批修改。提交列表与测试点聚合需要独立的一组 diff 和权限/封榜 E2E，不能以本批结果宣称其他 N+1 已解决。XCPCIO 的同步标记异常清理仍是独立正确性风险。本轮没有提交 Git commit 或覆盖原有改动。
