# Java / Spring Boot 代码质量审计（阶段一）

审计日期：2026-10-13。审计对象：`/Users/initial/qoj` 当前工作区中的后端源码，而非某个干净 Git 提交。本阶段没有修改业务代码、测试、依赖、数据库结构或配置，没有创建提交。

## 审计范围与证据边界

- 全量静态检索：455 个生产 Java 文件，共 41,286 行；目录、POM、应用配置、Mapper、事务与组件依赖、HTTP/Redis 使用、重复方法体、30 个 `*Test.java` 文件及 50 个 E2E 脚本入口。
- 深入追踪：题库列表与导入、普通/比赛/练习提交、判题队列及回调、ACM/OI 排名、公开榜单和导出、课程访问、班级成员、排行榜、资源授权、系统设置、XCPCIO 同步。认证、Agent、首页、管理统计及其他模块进行了静态筛查和关键实现抽查；并非每个方法都完成了动态验证。
- 项目采用 Java 17、Spring Boot 4.1.1、MyBatis-Plus 3.5.17、Spring AI 2.0.1；已有 Jackson 2、Redis、POI、PDFBox、腾讯 COS、Caffeine 等依赖。版本来自当前 POM，不是外部最新版本推荐。未发现必须为本轮重构新增 Guava 或其他依赖的理由。
- 构建配置见 [backend/pom.xml](/Users/initial/qoj/backend/pom.xml)；MyBatis 配置见 [backend/src/main/resources/application.yml:64](/Users/initial/qoj/backend/src/main/resources/application.yml:64)。本报告中的调用数来自源码路径推导，不是数据库抓包实测。事务内 MyBatis 一级缓存可能吸收重复读取，写操作也可能清空缓存；不能直接把 Mapper 调用数等同于实际 SQL 次数。
- 工作区已有大量未提交修改和未跟踪文件，报告描述的是读取时的状态。附带 Java 源码 SHA-256 清单，方便后续确认审计基线是否发生变化。

## 已确认的问题

P1：优先处理的成本放大或正确性问题；P2：局部维护性或中等收益问题；P3：低收益清理。未判定 P0 问题。

### A01 · 题库管理列表逐题补查统计和展示数据 · P1

**位置与证据：** [backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:145](/Users/initial/qoj/backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:145) 的 `adminList` 将分页结果逐条交给 `toAdminVO`（826 行）。每题分别调用 `countByProblemId`、`countAcceptedByProblemId`、`sampleCases`、隐藏测试点 `selectCount`，并通过 `folderName`、`ownerName`、`majorName` 补查元数据。

**问题：** 展示转换夹带 IO；分页条数增加会线性增加数据库访问，统计和样例读取不能因普通实体缓存而全部消失。

**建议：** 分页后收集题目 ID，按题目分组查询提交统计、隐藏测试点数量、样例；文件夹/专业批量查；作者必须以 `(ownerAccountType, ownerId)` 分组后查询对应账号表。保留现有 DTO 和字段。

**风险：中。** 必须保留统计 SQL 对比赛提交、判定状态等的原始过滤口径，以及样例顺序和作者账号类型隔离。

**预期收益：** 仅四类逐题统计/样例调用即可从 `4N` 降为约 3 类批量查询（合并提交总数与 AC 数），元数据补查另行批量化。N=20 时，这一部分由 80 次 Mapper 调用降到约 3 次；需 SQL 实测确认。

### A02 · 提交列表和导出存在逐行关联查询及测试点 COUNT · P1

**位置与证据：** [backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:416](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:416) 的 `adminList`、527 行的 `adminExportList` 均逐条调用 `toAdminVO`（965 行）；该方法逐条查询用户、比赛、比赛题目、练习、原题，并分别 COUNT 全部测试点与 AC 测试点。283 行的公共 `list` → 1032 行 `toVO` 也逐行查用户、标题、两个测试点数量。

**建议：** 复用现有 `selectBatchIds`，关联数据按当前页 ID 去重批量获取；在现有 `SubmissionCaseResultMapper` 增加按 submission_id 分组的统计查询。转换函数只组装已读取的数据，无需通用转换框架。

**风险：中。** 保留题目标题优先级、空关联回退、教师可见范围、冻结过滤、他人状态遮罩。禁止把所有测试点正文加载到内存后计数。

**预期收益：** 普通题提交每行固定的用户、题目及两个 COUNT 共 `4N` 次；20 行为 80 次附加调用，目标约 3 次批量调用（不含分页主查询和其他权限查询）。导出上限 10,000 条时，该路径可产生约 40,000 次附加调用，优先级高于简单工具去重。

### A03 · 同一批测试点为时间和内存分别读取；详情加载后仍额外 COUNT · P1

**位置与证据：** [backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:1032](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:1032) 的 `toVO` 在无正数 timeUsed/memoryUsed 且 `includeCases=false` 时，分别调用 1096 行的 `maxCaseTimeMs(Long)` 和 1124 行的 `maxCaseMemoryKb(Long)`；两者查询相同 submission_id 的完整测试点列表。详情模式则先做两个 COUNT，再加载同一组明细。

**建议：** 列表按提交批量聚合时间/内存及数量；已加载明细的详情直接一次遍历计算所需统计。保留“只接受正数、无有效结果返回 null”的行为。

**风险：低至中。** 需覆盖空测试点、0、负数、null、仅时间或内存缺失、尚在判题中的记录。若使用 SQL MAX，必须显式保留正数筛选。

**预期收益：** 同时缺失时间和内存时每条 2 次相同明细查询降到至多 1 次；详情明细加载后的 2 次 COUNT 可消除。应与 A02 同组实现，避免重复改动转换逻辑。

### A04 · 判题队列展示重复逐条补查 · P1

**位置与证据：** [backend/src/main/java/com/qoj/module/submission/service/SubmissionQueueService.java:79](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/service/SubmissionQueueService.java:79) 的 `list` 逐条调用 393 行的 `toVO`，后者查比赛、比赛题目、原题、用户；日志可见性判断中的 `isContestManager` 还可能重复读比赛。

**建议：** 与提交列表采用一致的局部批量取数方式；将当前页比赛实体传入对应权限判断，保留每条记录的授权决策。

**风险：中。** `includeLogs` 含权限语义；不能因共用数据而共用不同用户的授权结果。队列状态和持续时间需使用一致的时间基点。

**预期收益：** N 条普通记录的用户/原题补查由 `2N` 降为约 2 次批量查；比赛队列最多四类关联读取按 ID 批量化。权限查询单独计数。

### A05 · 全站排行榜同一用户重复读取并含逐用户训练日期查询 · P1

**位置与证据：** [backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:194](/Users/initial/qoj/backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:194) 的 `computeGlobal`：`filter(isStudentUser)` 查用户，map 再查，`getClassName`（260 行）又查同一用户；每个输出用户还调用 `trainingStreak` 查询首次 AC 日期。

**建议：** 在本次计算中批量获取候选用户并复用实体，批量取班级与成员回退信息；训练日期查询按用户分组。保留现有“分数表先取 5000，再过滤学生，再 limit”的行为，不顺手修改筛选顺序或上限。

**风险：中。** 主班级优先和 `LIMIT 1` 成员回退需保留；回退本身缺少稳定排序，不能擅自增加排序改变输出。不能用持久化 streak 替换按当天日期计算的值，否则会改变跨天表现。

**预期收益：** 每个进入 map 的学生当前至少 3 次相同用户的 Mapper 读取，可降为共享的 1 次批量读取；班级与训练日期从逐人读取变为分组读取。过滤阶段实际遍历人数由 limit 和角色分布决定，不能宣称总是读取全部 5000 人。

### A06 · 班级榜按班级和成员多层查询 · P1

**位置与证据：** [backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:219](/Users/initial/qoj/backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:219) 的 `computeClassRanking` 对每班查成员，对每个成员调用 `isStudentUser`，再按班查分数及教师。缓存未命中或刷新时触发。

**建议：** 取班级后批量读取成员、学生、分数、教师，在内存按班级分组；数据规模大时分块。也可在 Mapper 中聚合，但应先对照当前去重和角色过滤语义。

**风险：中。** 保留 `role=STUDENT`、普通题 AC 分数口径、无学生班级不展示、学生数和同分顺序；不要改为全量比赛提交累计。

**预期收益：** 当前约 `1+C+M+E+T` 次读取：C 为班级数，M 为跨班成员条目数，E 为含学生班级数，T 为需读取教师的班级数。目标约 5 类批量读取，另加大 IN 集合的分块成本。缓存只能降低执行频率，不能消除单次放大。

### A07 · 判题轮询在节流前逐键读取七个设置 · P1

**位置与证据：** [backend/src/main/java/com/qoj/module/judge/service/JudgeQueueScheduler.java:99](/Users/initial/qoj/backend/src/main/java/com/qoj/module/judge/service/JudgeQueueScheduler.java:99) 的 `pollAndDispatch` 每 200ms 调度，先调用 `getJudgeRuntimeSettings`，再判断 enabled 和 `shouldPoll`。[backend/src/main/java/com/qoj/module/setting/service/SystemSettingService.java:193](/Users/initial/qoj/backend/src/main/java/com/qoj/module/setting/service/SystemSettingService.java:193) 中七个设置经 `boolSetting`/`textSetting` 各自执行 `selectById`。`getFrontendSettings`（115 行）也逐键读取十个设置。

**建议：** 首先用现有 Mapper 批量查固定键并保留每个键独立的默认值/容错转换。优先不加跨请求缓存，避免改变配置生效时机。调整轮询节流顺序属于后续独立优化。

**风险：低。** 保留缺键、空值、非法数字和非正数的默认逻辑；判题开关即时性不变。

**预期收益：** 判题配置每轮 7 次读取降为 1 次。忽略任务执行耗时，200ms 调度约每秒 5 轮，对应这部分从约 35 次降到约 5 次；前端配置 10 次降为 1 次。该频率是理论估算，非吞吐压测结果。

### A08 · 公开比赛榜单再次逐行查询用户 · P2

**位置与证据：** [backend/src/main/java/com/qoj/module/contest/service/ContestService.java:3053](/Users/initial/qoj/backend/src/main/java/com/qoj/module/contest/service/ContestService.java:3053) 的 `toPublicRows` 在 `scoreboard.rows().stream().map` 内以 row.userId 查用户，仅补 username。其他榜单构造路径已经有用户批量读取的实现可参考。

**建议：** 在当前转换范围批量获取行用户；若沿上游复用用户 Map 不会扩散公共 API，可直接传递已有数据。

**风险：低至中。** 保留用户缺失时 ID 字符串回退、身份键、星标、冻结排名和滚榜揭晓状态。不要在这次修改中合并 ACM/OI 排名算法。

**预期收益：** R 行的 username 补查从 R 次降为一次或分块批量读取；不代表整个榜单只需一次 SQL。

### A09 · 比赛提交 ZIP 在两轮处理中重复查询同一批用户 · P1

**位置与证据：** [backend/src/main/java/com/qoj/module/contest/service/ContestInspectionExportService.java:90](/Users/initial/qoj/backend/src/main/java/com/qoj/module/contest/service/ContestInspectionExportService.java:90) 的 `submissionsZip`：`submissionsCsvText`（240 行）逐提交查用户；随后遍历相同提交生成路径，`codeEntryName`（341 行）再次查用户。

**建议：** 提取所有非空 userId，批量加载一个用户 Map，供 CSV 和路径生成复用。同文件 `registrationUsersCsv` 已采用批量用户 Map，可直接沿用其组织方式。

**风险：低。** 保留 ZIP 文件路径、用户名缺失回退、CSV BOM 和转义、提交排序与审计日志。

**预期收益：** N 条有用户的提交在这两部分共 2N 次用户读取，目标一次或分块批量读取；1000 条可从 2000 次附加 Mapper 调用降为少量批量调用。ZIP 整体缓存在内存的问题另列待验证事项。

### A10 · 学生课程详情重复进行同一组实体和班级读取 · P2

**位置与证据：** [backend/src/main/java/com/qoj/module/course/service/CourseService.java:88](/Users/initial/qoj/backend/src/main/java/com/qoj/module/course/service/CourseService.java:88)：`detail(false)` → `requireStudent`（190 行）→ `studentCanAccess`（181 行），先读取 Course 并调用 `studentClassId`；`requireStudent` 再读同一 Course；返回 detail 后再次调用 `studentClassId`，重复读 User 和成员 COUNT。

**建议：** 在本次学生详情链路复用已验证的 Course 和 classId；保留其他调用方使用的访问入口。必要时用仅表达这两项数据的局部结果，而非建立通用访问上下文框架。

**风险：低至中。** 保留 ACTIVE/ARCHIVED 的查看与提交差异、主班级必须存在成员关系、404 语义。

**预期收益：** 这条成功链路可消除 1 次 Course、1 次 User、1 次成员 COUNT，共 3 次重复 Mapper 调用；事务内 SQL 收益可能被一级缓存部分吸收。

### A11 · 班级、教师及成员展示转换仍逐行查关联数据 · P2

**位置与证据：** [backend/src/main/java/com/qoj/module/classroom/service/ClassRoomService.java:972](/Users/initial/qoj/backend/src/main/java/com/qoj/module/classroom/service/ClassRoomService.java:972) 的 `toTeacherVO` 查班级数和专业；993 行的 `toVO` 查教师及成员数；1018 行的 `toMemberVOs` 虽已批量取最后提交时间，1029 行的成员转换仍逐成员读 User 和 ClassRoom。

**建议：** 保留已有最后提交时间批量查询，补齐用户、班级、教师/专业批量读取及分组 COUNT；列表和详情分别按实际需要取数。

**风险：低至中。** 保留成员顺序、profileFields 解码、用户缺失回退、教师隔离。详情 `includeMembers=true` 时可以考虑复用 members.size，但先核对事务快照语义。

**预期收益：** N 个成员的用户/班级读取由约 2N 次降为约 2 次批量调用，固定单班详情可复用已取得班级。

### A12 · 资源授权循环查文件夹并可能重复查教师 · P2

**位置与证据：** [backend/src/main/java/com/qoj/security/policy/ResourceAccessService.java:86](/Users/initial/qoj/backend/src/main/java/com/qoj/security/policy/ResourceAccessService.java:86) 的 `canUseProblem` 查询 GRANT 后逐个 `folderMapper.selectById`；`canAccessFolder` → `canAccessScope`（50 行）在 MAJOR 分支读当前教师。

**建议：** 先按 grant.folderId 批量查文件夹，并在单次授权过程中复用教师数据；必须保留短路次序、账号类型、状态及 scope 解析异常。不要跨请求缓存授权结论。

**风险：中。** 权限敏感；未知/非法 scope 的异常行为、停用教师、不同账号类型相同数字 ID、所有者直接放行都要验证。批量读取应保留原 grant 顺序进行决策，避免提前检查原本不会访问的无效记录。

**预期收益：** 最坏 G 次文件夹补查降为一次/分块；重复教师读取降为最多一次。已有提前授权的请求收益可能为零。

### A13 · 比赛提交丢弃已校验/写入的数据后再次获取 · P2

**位置与证据：** [backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:160](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:160) 的 `submit` 先锁定 Contest，随后调用 `ContestService.requireSubmittableContestProblem`（1613 行），该方法又读 Contest、查询报名并调用 `ensureParticipant` 写入/刷新参赛者；返回后 submit 再查 `registrationForUser` 和 `participantForUser`。

**建议：** 复用锁定的 Contest，使校验阶段返回已经获得的比赛题目、报名和参赛者。该数据组确有多个消费字段，可用局部结果表达；不引入通用上下文/Manager 层。

**风险：中。** 必须保留 FOR UPDATE、校验顺序、IP/报名身份检查、ensureParticipant 的写副作用及提交时间语义。不能把有写副作用的方法当纯查询删除。

**预期收益：** 常规成功路径可省下再次读取 Contest、Registration、Participant 的三次 Mapper 调用；同事务缓存和中途写操作对实际 SQL 数的影响必须实测。

### A14 · 判题状态推送重复触发队列刷新 · P2

**位置与证据：** [backend/src/main/java/com/qoj/module/ws/JudgeMessagePublisher.java:29](/Users/initial/qoj/backend/src/main/java/com/qoj/module/ws/JudgeMessagePublisher.java:29) 的 `submissionChanged` 内部调用 `submissionQueueUpdated`。[backend/src/main/java/com/qoj/module/judge/service/JudgeQueueScheduler.java:218](/Users/initial/qoj/backend/src/main/java/com/qoj/module/judge/service/JudgeQueueScheduler.java:218) 的完成路径随后又显式刷新；154–155 行的拒绝恢复路径、401–402 行的失败路径有相同重复。

**建议：** 每个状态变更保留一个队列刷新，调用方复用 publisher 已有行为，避免同时改消息载荷。先确认前端是否对重复事件存在特殊依赖。

**风险：中。** 消息次数可被外部观察；需 E2E 验证客户端最终刷新和断线重连。这是明确冗余事件，不能在“外部行为完全不变”要求下未经验证直接删除。

**预期收益：** 这些路径每次状态变化发送的队列 refresh 从 2 条降至 1 条；状态消息仍为 1 条。不能直接推断前端 HTTP 请求也必然减半，客户端可能已有合并刷新。

### A15 · 两套 ZIP 解析及两套训练天数算法重复 · P2

**位置与证据：** [backend/src/main/java/com/qoj/module/problem/service/ProblemDraftService.java:342](/Users/initial/qoj/backend/src/main/java/com/qoj/module/problem/service/ProblemDraftService.java:342) 的 `parseZip` 与 [backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:1312](/Users/initial/qoj/backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:1312) 的 `parseZipTestCases` 重复遍历 ZIP、文件名校验、编号提取、资源上限、输入/输出配对和进度处理。`safeZipEntryName`、`caseNumber` 方法体在去注释/空白后相同。[backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:282](/Users/initial/qoj/backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:282) 的 `trainingStreak` 与 [backend/src/main/java/com/qoj/module/user/service/UserScoreService.java:65](/Users/initial/qoj/backend/src/main/java/com/qoj/module/user/service/UserScoreService.java:65) 的 `computeTrainingStreak` 方法体也相同。

**建议：** ZIP 复用一个问题域内的解析实现，得到现有请求数据结构后由持久化路径创建实体；不要把数据库写入和 Redis 草稿生命周期合并。连续训练计算可先复用现有 UserScoreService 的领域能力/纯计算部分，避免只为几行算法建立泛用工具库。

**风险：中（ZIP）、低至中（训练天数）。** ZIP 两条路径的错误文案和允许缺失输出条件存在差异，需保留；训练天数以当前日期计算，不能直接读旧 user_scores.streak。

**预期收益：** ZIP 安全校验从两个维护点降为一个；连续天数算法从两个维护点降为一个。本项不承诺数据库次数减少，也不以删除行数衡量收益。

### A16 · 无消费方的 RestClient Bean 与模板化注释 · P3

**位置与证据：** [backend/src/main/java/com/qoj/config/AppConfig.java:40](/Users/initial/qoj/backend/src/main/java/com/qoj/config/AppConfig.java:40) 定义 RestClient Bean；生产 Java 全文检索 RestClient 仅命中该文件，go-judge 实际使用 JDK HttpClient，Agent 使用 Spring AI。约 895 行匹配模板化注释检索模式，例如“封装…相关逻辑”“保持该职责的输入、输出…”；这只是模式匹配数量，不等于应删注释数量，也不能据此判断作者来源。

**建议：** 核对按 Bean 名/运行时动态消费后删除未用 Bean；只在正在修改的方法附近删除无信息量或错误的注释，保留并发、事务、安全约束和协议说明。不要为合并 HTTP 客户端而改写 go-judge。

**风险：低（确认无动态消费后）。** 清除 Bean 前核对实际启动上下文；注释改动与性能改动分开。`JudgeService` 还承载 SandboxResult 等领域契约，不能仅因单实现删除。

**预期收益：** 减少一个无静态消费方的基础设施 Bean 和错误维护线索；无可证明性能收益。

### A17 · XCPCIO 同步标记清理范围存在异常缺口 · P1，正确性修复单列

**位置与证据：** [backend/src/main/java/com/qoj/module/xcpcio/service/XcpcioSyncService.java:67](/Users/initial/qoj/backend/src/main/java/com/qoj/module/xcpcio/service/XcpcioSyncService.java:67) 的 `syncContest` 在 `runningContestIds.add` 后，先执行 `syncLogMapper.insert`、`configService.findByContestId`，之后才进入 try/finally。前两项若抛异常，后面的 `remove` 不会执行。

**问题：** 单 JVM 内后续同步可能一直返回“正在同步中”，直至进程重启。该异常路径可由控制流确认，尚未故障注入复现。

**建议：** add 成功后立即进入覆盖整个同步生命周期的 try/finally；日志/配置尚未创建时的失败处理需显式区分，不能盲目调用 markFailed(null)。

**风险：低至中。** 故障路径行为会得到修正，应作为独立正确性提交，而非混入不改变行为的纯重构。保持成功路径日志、状态和异常码不变。

**预期收益：** 日志插入或配置读取异常后，本地运行标记能够释放；故障注入后再次同步不再被残留标记永久阻挡。没有吞吐量收益承诺。

### A18 · 队伍列表逐队读取成员 · P2

**位置与证据：** [backend/src/main/java/com/qoj/module/team/service/TeamService.java:53](/Users/initial/qoj/backend/src/main/java/com/qoj/module/team/service/TeamService.java:53) 的 `list` 逐队调用 117 行 `toVO`，每次 `userMapper.selectList(team_id)`。

**建议：** 一次读取这些 teamId 的成员，按 teamId 分组；保留队伍与成员的 id 升序，单队详情可保留局部查询。

**风险：低。** 空队伍、用户归队变化及排序要覆盖。

**预期收益：** T 个队伍的成员查询从 T 次降为一次或分块批量读取；通常收益低于提交列表和轮询配置优化。

## 尚未验证的风险与暂不建议改动的事项

1. **取消判题与回调的竞态（P1，待并发复现）。** SubmissionQueueService.cancel（186 行）普通读取后 updateById，而 JudgeCallbackService（89 行附近）先 FOR UPDATE 再判定终态。需构造取消/回调/worker 完成的并发交错，观察终态和元数据是否可能被旧值覆盖；不能因为有 @Transactional 就断言并发安全，也不能未复现就改状态机。
2. **事务提交前推送及 Redis 副作用（P2，待故障验证）。** SubmissionService.submit 和队列操作在事务内写 Redis/推送；回滚可能留下限流计数或刷新事件。限流通常允许独立于数据库事务，不能统一当错误。需检查回滚后客户端最终一致性，再决定是否使用现有 Spring 事务事件机制。
3. **跨节点 XCPCIO 同步互斥（P2，部署相关）。** runningContestIds 是单 JVM Set。多实例若共享同步任务可能并行执行；当前未确认部署副本数和同步副作用，不直接引入分布式锁。
4. **提交/导出/榜单的数据量与索引（P2，待 SQL 实测）。** ZIP 用 ByteArrayOutputStream 保存完整输出，榜单和重建会加载多条提交；需真实数据量、EXPLAIN、堆占用和 p95 后再选择流式输出或查询改写。本轮不建议凭猜测新增索引或改表。
5. **依赖和序列化迁移（P3，待独立专项）。** POM 有 Caffeine，但生产源码未检索到直接 API 使用；不等于依赖在运行时无用途，需解析依赖树和自动配置后才能删除。Jackson 2 与 Boot 4 迁移组合在 POM 有明确说明；两处 static ObjectMapper 也不是“每请求重复创建”。不建议在本轮顺手统一或迁移。
6. **超大 Service 的职责边界（P2，维护性信号）。** ContestService 3225 行，ProblemService 1439 行，SubmissionService 1245 行。它们承担授权、查询、转换和业务编排；行数本身不证明必须拆分。先将 IO 从列表转换中移出，再依据稳定业务边界决定是否迁移方法，禁止新增成串 Manager/Helper。
7. **旧 ProblemVO 迁移未结束（P3）。** ProblemVO 标记 forRemoval，实际仍被比赛、草稿和 Agent 等路径使用，编译有警告。不能删除或直接替换为 AdminProblemVO/PublicProblemVO，这可能改变外部字段和代码/测试点暴露范围。需要消费者清单和响应快照专项。
8. **未发现可确认的重复远程执行。** GoJudgeClient 保留单个 HttpClient，run 明确不重试；多个测试点、编译、checker、通信题多阶段调用各有语义。AgentModelFactory 复用模型并维护取消状态。未发现证据支持对这些调用做合并/去重；重试与取消仍需运行验证。
9. **未发现静态字段类型图中的组件循环。** 此检查仅覆盖可识别的注入字段类型，不包含所有接口绑定、Bean 工厂方法和动态查找；现有测试未启动完整 Spring 上下文，不能据此保证运行时没有循环依赖。

## 应保留和复用的现有设计

- MyBatis/Mapper 接口对应 SQL 和实体访问，不把普通 BaseMapper 接口判作多余封装。新增批量聚合应放在对应现有 Mapper。
- UserAdminService.list 已批量获取班级、最后提交时间与分数；PracticeService 的部分路径、ContestAcmRankService/ContestOiRankService 已使用批量关联读取。按这些现有模式逐步修复，无需统一 Repository 框架。
- JudgeQueueScheduler 的原子 claim、拒绝恢复、workerId 校验，JudgeCallbackService 的行锁与幂等终态检查，以及 Contest 更新/提交共享的行锁属于必要并发控制。
- GoJudgeClient 的响应上限、鉴权、禁止 run 重试、InterruptedException 恢复中断、资源清理容错均有意义，不按“try-catch 多”机械删除。
- 不合并不同账号类型的 ID，不缓存跨请求权限结论，不删除教师隔离校验，不改变封榜/滚榜行为。
- Spring AI 客户端与取消封装有实际生命周期职责；Controller 的轻量委托通常是合理边界，重载默认参数转发也不自动认定为冗余。

## 渐进式修改建议（尚未执行）

| 顺序 | 一组相关修改 | 原因及验收重点 |
| --- | --- | --- |
| 1 | A07 固定配置批量读取 | 高频、范围小；所有缺省/非法值输出保持一致，7→1、10→1，配置生效时机不变 |
| 2 | A02+A03 提交列表与测试点聚合 | 最大查询放大之一；普通/比赛/练习、教师隔离、冻结、统计和资源缺失回退 |
| 3 | A09 导出用户批量读取 | 单请求重复明显；CSV 内容及 ZIP 路径逐项对照 |
| 4 | A05+A06 排行榜取数 | 保留学生过滤、AC 口径、同分顺序、跨天 streak 和缓存 TTL |
| 5 | A01 题库管理列表；A04 队列展示 | 分别提交；统计范围、样例、账号类型与日志权限回归 |
| 6 | A08/A10/A11/A18 各自独立处理 | 每个领域一个 diff；限制变动范围，禁止一次改所有列表 |
| 7 | A12/A13 权限与提交数据复用 | 权限/并发风险更高，先建立真实 E2E 与 SQL 基线，再改 |
| 8 | A14/A15/A16 消息与重复逻辑清理 | 消息次数先验证客户端依赖；ZIP 先列失败场景再实现共享解析 |

A17 是正确性修复，建议独立于上述纯重构序列尽早处理；先故障注入验证标记释放。任何阶段均不顺带改变数据库结构、返回字段或技术栈。

## 验证基线与后续可重复验证方案

**已执行：** 在 backend 目录运行 `mvn test`，455 个生产文件重新编译成功；177 项测试，0 失败、0 错误、0 跳过，BUILD SUCCESS，Maven 总耗时 5.407 秒。该耗时是一次构建日志值，不是接口性能指标。存在 ProblemVO 待删除的编译警告，未掩盖或修改。

**尚未执行：** Spring 完整启动、真实 MySQL/Redis/go-judge 集成、50 个 E2E 脚本、SQL/远程调用动态计数、并发故障注入、p95/内存对比。本阶段仅审计，未启动或修改数据库、未调用远程判题或 AI 服务。POM 未配置专用 Failsafe 集成测试阶段；测试源码中未检索到 @SpringBootTest/@WebMvcTest 等上下文测试注解。因此 177 项通过不能代替运行时集成证明，也不能声称已经验证重构前后等价。

**已有 E2E 可复用入口：** [tools/e2e/class-leaderboard-ac.mjs](/Users/initial/qoj/tools/e2e/class-leaderboard-ac.mjs)、[tools/e2e/course-refactor.mjs](/Users/initial/qoj/tools/e2e/course-refactor.mjs)、[tools/e2e/teacher-student-management.mjs](/Users/initial/qoj/tools/e2e/teacher-student-management.mjs)、[tools/e2e/admin-test-case-import-backend.mjs](/Users/initial/qoj/tools/e2e/admin-test-case-import-backend.mjs)、[tools/e2e/contest-roster.mjs](/Users/initial/qoj/tools/e2e/contest-roster.mjs)、[tools/e2e/beui-scoreboard.mjs](/Users/initial/qoj/tools/e2e/beui-scoreboard.mjs)。这些是后续候选入口，本轮没有运行。尤其 class-leaderboard-ac 脚本会写测试数据、启动后端、占用 Redis DB 14 并清理，运行前须核对环境和已有 jar 是否对应当前源码。

**实施前列出的失败场景：** 空页/空关联；重复 ID 和缺失用户；不同账号类型同 ID；教师停用、无授权和跨专业；判题尚未完成、终态和重判；资源为 0/负数/null；AC/ACCEPTED 口径；主班级与回退成员；并发入队/取消/回调；配置缺失/空值/非法值；跨午夜训练连续天数；封榜/解封/滚榜；ZIP 路径穿越、重复文件、缺失输出、超大展开体、通信题公开输入、进度和失败文案。

**每组改动验收产物：** 在隔离数据和相同请求下保存响应 JSON、数据库副作用快照、按 SQL 指纹归组的实际执行次数、Redis/HTTP/WebSocket 调用计数、E2E trace/截图、测试数据清理结果、源码 SHA-256 与执行命令。统计 SQL 应在实际执行处采集，不能只计 Mapper 方法调用。配置及权限无需全局缓存；只复用请求内数据。涉及并发时追加交错轨迹。代码修改前建立 E2E 基线，不补写与实现镜像的单元测试。

**本次量化结果：** 实际业务代码改动 0，删除冗余代码 0，新增依赖 0，实际优化收益尚未产生。A01–A18 的数字均是可验收目标或静态调用推导，必须在第二阶段实施后用同一批 fixture 测量。

## 交付文件

- 本报告：[docs/java-quality-audit-2026-10-13.md](/Users/initial/qoj/docs/java-quality-audit-2026-10-13.md)。
- 构建与测试原始日志：[output/java-quality-audit-2026-10-13/mvn-test.log](/Users/initial/qoj/output/java-quality-audit-2026-10-13/mvn-test.log)。
- 源码哈希及规模基线：[output/java-quality-audit-2026-10-13/baseline.json](/Users/initial/qoj/output/java-quality-audit-2026-10-13/baseline.json)。
- Java 文件清单：[output/java-quality-audit-2026-10-13/java-files.txt](/Users/initial/qoj/output/java-quality-audit-2026-10-13/java-files.txt)。

复跑基础验证：`cd /Users/initial/qoj/backend && mvn test`。进入第二阶段前，应先核对 baseline.json 的源码哈希；当前工作区已有改动，不自动提交、重置或重写这些文件。
