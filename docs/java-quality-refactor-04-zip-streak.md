# 第 4 批：删除重复 ZIP 解析与训练天数算法

日期：2026-10-13。对应[复杂度专项报告](/Users/initial/qoj/docs/java-complexity-and-reuse-audit-2026-10-13.md) C03、C06，以及原审计 A15。本批执行两组有独立差异的局部重构，其他审核项未修改。

## 实际完成的修改

### ZIP：安全规则从两个维护点收敛到一个

原 `ProblemService.parseZipTestCases` 和 `ProblemDraftService.parseZip` 各自维护编号解析、路径检查、输入/输出/public2 配对、重复检测、上传与展开限额及读取进度。三个 helper 和五个限额常量也分别存在两份。

- 新增包内可见的 [TestCaseZipReader.java](/Users/initial/qoj/backend/src/main/java/com/qoj/module/problem/service/TestCaseZipReader.java)，集中维护现有解析规则，返回已有 `ProblemTestCaseRequest`；继续使用 JDK `ZipInputStream`。
- [ProblemDraftService.java](/Users/initial/qoj/backend/src/main/java/com/qoj/module/problem/service/ProblemDraftService.java) 删除解析循环和三个 helper，只保留入口校验差异；草稿生命周期、Redis 保存、追加编号及保存事件不变。
- [ProblemService.java](/Users/initial/qoj/backend/src/main/java/com/qoj/module/problem/service/ProblemService.java) 删除另一套解析循环和 helper，读取共享结果后转现有实体；权限、事务、覆盖/追加和数据库写入保持原样。

新增一个有两个消费者的领域解析类，替代两份完整实现；没有增加接口、策略、工厂、通用导入框架、Spring Bean 或依赖。空 ZIP 错误文案作为入口参数保留，不用枚举策略扩展抽象。

### 训练天数：复用已有 UserScoreService

- [UserScoreService.java](/Users/initial/qoj/backend/src/main/java/com/qoj/module/user/service/UserScoreService.java) 将原私有 `computeTrainingStreak` 调整为可复用的 `trainingStreak`，计算与 SQL 保持不变，分数重算使用同一方法。
- [LeaderboardService.java](/Users/initial/qoj/backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java) 删除复制的算法；两个调用位置直接使用 `UserScoreService.trainingStreak`，相应构造依赖由 SubmissionMapper 替换为已有 UserScoreService。

没有增加日期工具类，也没有读持久化 streak 来代替实时计算。UserScoreService 只依赖 Mapper，没有增加反向服务依赖。当前工作区既有的班级榜缓存 TTL、分数汇总等改动未改动，不能把完整 Git diff 中这些旧改动计入本批。

## 量化变化

| 指标 | 前 | 后 |
| --- | ---: | ---: |
| ZIP 配对/遍历算法维护点 | 2 | 1 |
| ZIP 路径、编号、限额读取 helper 各自份数 | 2 | 1 |
| ZIP 限额常量组 | 2 | 1 |
| 连续训练天数算法维护点 | 2 | 1 |
| 本批涉及生产文件总行数，含新增类 | 2,332 | 2,181 |
| ProblemService 行数 | 1,439 | 1,315 |
| ProblemDraftService 行数 | 508 | 374 |
| LeaderboardService 行数 | 304 | 283 |

生产代码净减少 151 行。收益是减少安全规则和业务算法的维护分叉，不以删除行数为唯一目标，也没有宣称接口延迟、吞吐或数据库查询减少。ZIP E2E 的每次请求 SQL 次数前后相同；训练天数仍调用原 Mapper/SQL。

## 原行为与差异均保留

绿色旧实现基线确认以下差异，本批未修正它们：

- 正式入口接收有效 ZIP 字节时不要求 `.zip` 文件名；草稿入口要求该后缀。
- 普通题空 ZIP：正式入口返回“ZIP 中未找到测试点”，草稿返回“ZIP 中未找到 1.in/1.out 格式测试点”；允许无输出的草稿使用前者。
- 草稿 ZIP 导入允许编号 0；正式导入在保存验证阶段拒绝。解析仍按原编号排序，追加行为各自保留。
- 两条路径都允许空白输出；普通题要求存在 `.out/.ans`，SPJ 和通信题允许文件缺失并使用原空字符串兜底。
- 保留 reading、parsed、savingDraft/saved 等事件内容与顺序，正式导入的保存进度仍来自原数据库写入路径。
- 训练日期 SQL 仍按每题首次 AC/ACCEPTED 日期计算，且该日期查询包含比赛提交；分数计数仍排除比赛，并按既有 AC 口径统计，没有顺手统一两种口径。

## 验证与产物

先写[失败场景](/Users/initial/qoj/docs/zip-streak-dedup-failure-cases.md)和 [HTTP E2E](/Users/initial/qoj/tools/e2e/zip-streak-dedup.mjs)，运行旧实现取得绿色基线后才修改生产代码。没有新增或修改单元测试。测试准备中曾将“空白输出应失败”误作预期，核对源码及真实旧行为后改为成功场景；草稿编号 0 的差异同样在改代码前固定。

- 修改前 `mvn test`、`mvn package` 通过；ZIP 去重单独构建及最终 `mvn package` 均通过。最终 177 项既有测试，0 失败、0 错误、0 跳过。
- 最终 E2E 7 项综合检查通过，包含 **48 次 ZIP 上传、10 组训练日期场景**的完整前后对照。
- ZIP 使用真实生产 jar、HTTP multipart/NDJSON、Security、Service/MyBatis、MySQL 和 Redis：覆盖成功/覆盖/追加/非流式、嵌套与反斜线、忽略文件、重复 input/output/ans、孤立 out/public2、路径穿越/绝对路径、超大编号、空 ZIP/空文件、空白与缺失输出、SPJ/通信题、200 点成功边界、201 点拒绝、651 entry 拒绝、单 entry 超 50MiB、总展开超 50MiB。
- 每个失败上传都核对原数据库测试点或草稿未被覆盖。隐藏测试点 GET 验证匿名 401、学生 403；本批没有改权限代码。
- 训练天数验证空日期、今天、昨天、断档、同日多题、旧日期、未来日期、ACCEPTED、同题重复 AC、比赛日期。通过真实 HTTP 删除无关 WA 提交，触发原有事务中的 `recompute`，核对 MySQL 的 streak/ac_count/total_score/submit_count/rating；同时验证用户榜和全站榜实时 streak，不读取预置的错误持久化值 999。
- 58 组响应/状态前后完全一致；48 次上传的进度与 SQL 次数也完全一致。只规范化随机 draftId；未移除业务字段或进度事件来掩盖差异。
- 测试运行在随机临时 schema（仅复制结构，无业务数据）和专用 Redis；前后均确认进程停止、容器及 schema 删除。公共环境启动/清理放入 [disposable-backend.mjs](/Users/initial/qoj/tools/e2e/support/disposable-backend.mjs)，供后续 E2E 复用，没有改写已通过的三个旧脚本。
- E2E 脚本语法检查、生产改动 `git diff --check` 通过。原构建弃用和 JVM agent 警告未屏蔽。

工作区原有大量改动，以下 patch 都以本批开始时的快照为基线，便于分别审查：

- [ZIP 独立 diff](/Users/initial/qoj/output/java-quality-refactor-04/zip-dedup.patch)
- [训练天数独立 diff](/Users/initial/qoj/output/java-quality-refactor-04/streak-dedup.patch)
- [量化对照、源文件哈希与清理结果](/Users/initial/qoj/output/java-quality-refactor-04/comparison.json)
- [旧实现 HTTP 报告](/Users/initial/qoj/output/zip-streak-dedup-e2e/before/report.json)、[最终 HTTP 报告](/Users/initial/qoj/output/zip-streak-dedup-e2e/after/report.json)
- [修改前构建日志](/Users/initial/qoj/output/java-quality-refactor-04/before-build.log)、[最终构建日志](/Users/initial/qoj/output/java-quality-refactor-04/after-build.log)

从仓库根目录复跑：

```sh
(cd backend && mvn package)
node tools/e2e/zip-streak-dedup.mjs after
```

需要 Docker、Java、Python 3、项目 `.env`、现有 qoj-mysql/qoj-redis 容器，以及保留的 before 报告。before 模式只能搭配旧实现 jar；不能用当前实现覆盖旧基线。脚本使用 dedup-audit 管理前缀，只通过真实 HTTP 调用生产能力，没有新增测试专用后端接口。

## 验证限制及待处理事项

没有测试上传压缩文件本身超过 50MiB、故障注入导致 SQL 写入失败后的回滚、HTTP 客户端断开、全部 ZIP 损坏方式、并发草稿保存或跨午夜压力。已验证的是展开资源上限、解析/保存校验失败不覆盖旧数据；不能把它称为所有数据库故障下的事务证明。测试期间没有跨日，跨午夜运行须重新取得同日基线。

测试 schema 关闭 Flyway，没有迁移变更，未重跑迁移链。未做性能压测。编号 0 等已有差异仍是后续正确性清理候选，不在本批纯去重范围。

Agent Servlet 适配与入口收敛、CSV 解析差异、旧 DTO 迁移等 C01/C02/C04/C05 未修改；此前记录的账号类型 ID 碰撞权限风险仍需独立修复。本批没有 Git commit，没有改外部 API、数据库结构或权限规则。
