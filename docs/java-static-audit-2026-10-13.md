# 全后端静态质量审核：未使用代码、编译告警、复杂度与重复

日期：2026-10-13，基于第 4 批去重后的当前工作区。此前审核偏重业务调用链与重复实现，未覆盖完整的 unused/lint/字节码规则；本轮补齐这些检查。**本轮只审核，没有删除生产代码、改依赖或修改测试。**

## 范围、工具和证据

| 检查 | 实际执行范围 | 结果与解释 |
| --- | --- | --- |
| 现有 Maven 测试 | backend | 177 项，0 失败/错误/跳过 |
| javac `--release 17 -Xlint:all -Xmaxwarns 10000` | 457 个生产 Java、32 个测试 Java | 编译成功；165 条告警，生产 94、测试 71 |
| PMD 7.28.0 | 上述 489 文件，51 条选择规则，带项目 classpath | 752 条原始告警，生产 736、测试 16；无解析/规则处理错误 |
| SpotBugs 4.10.5 | 当前 Maven 编译后的生产字节码，含内部类 | 929 条原始告警；分析错误 0、缺失依赖类 0 |
| CPD 7.28.0 | 全部 457 个生产文件，至少 100 token | 12 组重复片段 |
| Maven dependency:analyze | 编译依赖及使用情况 | 完成；结果需结合 Spring 自动配置/反射解释 |
| 人工复核 | 无用 import、私有方法、注入字段、死局部变量、代表性复杂方法与误报 | 见下文；未逐条确认所有原始规则告警 |

这些告警**不能相加当作缺陷数**：同一问题可能被多个规则报告，复杂度包含类/方法两种口径，实体/DTO 经 MyBatis/Jackson 使用会造成大量误报。工具优先级也不是业务严重度；例如 SpotBugs 唯一 priority=1 是 logout 中一次装箱再拆箱，不是严重安全漏洞。

本机运行 JDK 26.0.1，编译明确使用 Java 17 API/字节码目标。首次 PMD 7.17.0 不支持 JDK 26 class major 70，分析中断；其日志和不完整报告单独保留，**最终统计使用兼容版本的完整结果**。PMD 对当前 JDK auxiliary classpath、数条规则将来弃用的提示未隐藏。

原始结果与每一条位置均可查：

- [汇总 JSON](/Users/initial/qoj/output/java-static-audit-2026-10-13/summary.json)
- [PMD 逐项可点击清单](/Users/initial/qoj/output/java-static-audit-2026-10-13/findings.md)、[CSV](/Users/initial/qoj/output/java-static-audit-2026-10-13/findings.csv)、[XML](/Users/initial/qoj/output/java-static-audit-2026-10-13/pmd.xml)
- [SpotBugs 全量结果 JSON](/Users/initial/qoj/output/java-static-audit-2026-10-13/spotbugs-findings.json)、[含消息 XML](/Users/initial/qoj/output/java-static-audit-2026-10-13/spotbugs.xml)
- [全部编译告警](/Users/initial/qoj/output/java-static-audit-2026-10-13/javac-lint.log)、[结构化编译告警](/Users/initial/qoj/output/java-static-audit-2026-10-13/compiler-warnings.json)
- [CPD 12 组位置](/Users/initial/qoj/output/java-static-audit-2026-10-13/clones.json)、[原报告](/Users/initial/qoj/output/java-static-audit-2026-10-13/cpd.xml)
- [依赖分析日志](/Users/initial/qoj/output/java-static-audit-2026-10-13/dependency-analysis.log)、[测试日志](/Users/initial/qoj/output/java-static-audit-2026-10-13/maven-tests.log)

## 一、确认存在的冗余与实现问题

### S01 · 无用 import：29 处 · P3，低风险

生产代码 **20 处**、测试 **9 处**，AST 判断为未使用 import，包含普通与 static import。完整路径、行号和 import 原文见[全部 29 处清单](/Users/initial/qoj/docs/java-unused-imports-2026-10-13.md)，没有只给示例而省略剩余项。

典型位置：SecurityConfig 的 UrlBasedCorsConfigurationSource、OpenAiCompatibleAgentClient 的 OpenAiChatModel、PracticeService 的 Page/ProblemVO/Authentication/SecurityContextHolder、LeaderboardService 的 HashMap/Map/Collectors、ProblemService 的 HashMap。

**建议：** 作为一个独立、可自动核对的清理批次删除准确行，禁止顺带全文件格式化。**收益：** 29 个无用 import→0；无运行性能收益。前几批业务去重没有顺便完成这类全项目清理，本轮明确补列。

### S02 · 无调用私有方法：生产 14 个、测试 1 个候选 · P2/P3

PMD 与 SpotBugs 分别识别 15 个含测试 / 14 个生产候选；交叉检索测试及 E2E 夹具的相关反射字符串，没有发现对这些明确签名的调用证据。完整签名和行号见[15 个私有方法清单](/Users/initial/qoj/docs/java-unused-private-methods-2026-10-13.md)。其中包括：

- AuthService.ensureScore(Long)。其 UserScoreMapper **仍被其他方法使用**，不能连带删除依赖。
- ContestService 的 buildScoreboard(Contest)、requireOwnerOrSuperAdmin(long)、isOwner(Contest, AuthUser)、emptyStanding、identityKey(String, Long)、isRankedSubmission(Contest, Submission)。有同名重载仍在使用，不能按方法名全删。
- ProblemService 的 replaceHiddenTestCases(Long, List)、requirePublicManageOwner、withAttemptStatuses(List<ProblemVO>, Long)、sampleEntities(String)、accountType、normalizeAccountType。
- ProblemFolderService.accountType，以及测试的 SystemSettingServiceTest.setting。

**建议：** 删除前核对运行时反射及兼容用途，逐个删除具体签名并编译；对关联的旧 DTO 迁移单列处理。**风险：低至中。收益：** 删除无静态消费者的方法和其独占代码。不能将其外推为“所有无源码调用的 public 方法都可删除”，Controller、Bean、定时任务和 Mapper 是框架入口。

### S03 · 7 个只注入/赋值、从未读取的字段 · P2，低至中风险

SpotBugs `URF_UNREAD_FIELD` 后通过全文引用核实，下列字段在当前类只出现于声明、构造参数/赋值，没有业务读取：

| 文件 | 字段 |
| --- | --- |
| [AdminContestController.java:56](/Users/initial/qoj/backend/src/main/java/com/qoj/module/contest/controller/AdminContestController.java:56) | contestRegistrationMapper |
| [PracticeController.java:25](/Users/initial/qoj/backend/src/main/java/com/qoj/module/practice/controller/PracticeController.java:25) | practiceService |
| [SystemSettingService.java:87](/Users/initial/qoj/backend/src/main/java/com/qoj/module/setting/service/SystemSettingService.java:87) | environment |
| [SubmissionService.java:78](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:78) | problemTestCaseMapper |
| [SubmissionService.java:91](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:91) | practiceProblemMapper |
| [SubmissionService.java:92](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:92) | practiceAccessPolicy |
| [ClicsExportService.java:62](/Users/initial/qoj/backend/src/main/java/com/qoj/module/xcpcio/service/ClicsExportService.java:62) | configMapper |

**建议：** 同步移除字段、构造参数及相关 import，核对显式构造的测试/夹具，再运行 Spring 启动和既有测试。不能顺手删除这些类型本身，其他组件仍会消费。**收益：** 7 个假依赖消除，构造器反映真实职责；不承诺明显启动加速。

PMD 的 UnusedPrivateField 本轮为 0，而字节码发现上述只写不读字段，说明只跑单一 unused 规则不足。

### S04 · 死内部类型及字段 · P2，低风险

[ContestService.java:2893](/Users/initial/qoj/backend/src/main/java/com/qoj/module/contest/service/ContestService.java:2893) `StandingAccumulator` 只在无调用的 `emptyStanding` 中实例化。其 contestId/identity/solved/penalty/score/attempts/acceptedProblems 从不读取，lastAcTime 从不使用。

**建议：** 连同无调用方法删除整个内部类，不逐字段增加 SuppressWarnings。**收益：** 删除一个不可达积累器类型及 8 个无业务消费字段。需核对反射用途，本轮未找到。

### S05 · 两套排名服务读取用户后完全不使用结果 · P2，低至中风险

[ContestAcmRankService.java:288](/Users/initial/qoj/backend/src/main/java/com/qoj/module/contest/service/ContestAcmRankService.java:288) 与 [ContestOiRankService.java:273](/Users/initial/qoj/backend/src/main/java/com/qoj/module/contest/service/ContestOiRankService.java:273) 的 getRankList 收集 userId、批量查用户，再在循环分别于 313/298 行赋给 `User user`，但后续 VO 只使用参赛者等数据，完全没有消费该变量。全文检索确认两个类的 UserMapper 仅用于这段无效读取。

**建议：** 删除用户 ID 收集、Map、死变量与整段查询，再移除对应 UserMapper 注入。**预期收益：** 每个非空排名请求少一次用户批量 Mapper 查询，减少数据和依赖；实际 SQL 次数仍需端到端测量。不能只删 `User user` 而保留上游查询。

### S06 · 未使用参数、结果和占位实现需要分开处理 · P2/P3

- **6 个未使用形参：** ContestOiRankService.updateTotalRank 的 fullScore；ContestService.resolveRegistrationIdentity 的 requestedId、identityFromSubmission 的 contestId、identityName 的 type；SubmissionQueueService.waitingDurationMillis 的 finishAt；LeaderboardService.weekAcCount 的 userId。前五者可评估收窄私有签名；请求字段是否有兼容语义需另核实。
- **未完成计算：** [LeaderboardService.java:275](/Users/initial/qoj/backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:275) weekAcCount 无条件返回 0，参数未读。确认是当前实现行为，但“应该计算什么”属于业务需求，不能在清理 unused 时补写新规则。
- **无用初始化：** SubmissionService.submit 的 `Problem problem = null` 在实际使用前重赋值，可简化声明；没有查询收益。
- **仅结果无用，调用必须保留：** [PracticePublicationService.java:225](/Users/initial/qoj/backend/src/main/java/com/qoj/module/practice/service/PracticePublicationService.java:225) `addedProblems = requireUsableProblems(...)` 的变量未使用，但调用承担新增题目的授权/可用性校验。可删除变量绑定，**不能删除调用**。

**收益：** 缩小无效参数与变量，明确空实现；不改变业务行为的批次只做机械清理。请求契约和 weekAcCount 需要独立验收。

### S07 · 真实复杂度热点，超过此前“长类”筛查 · P1/P2

PMD 计算得到 86 条认知复杂度、215 条圈复杂度、54 条 NPath 告警；可能包含同类/同方法重复维度，不是 355 个独立缺陷。典型方法：

| 文件、方法 | 认知复杂度 | 人工复核的职责 |
| --- | ---: | --- |
| [OpenAiCompatibleAgentClient.java:122](/Users/initial/qoj/backend/src/main/java/com/qoj/module/agent/service/OpenAiCompatibleAgentClient.java:122) runAgentSegment | 191 | 历史还原、工具查找、缓存、审批、执行、取消/超时、观测及 checkpoint 混在一条循环 |
| [AdminChatImportService.java:135](/Users/initial/qoj/backend/src/main/java/com/qoj/module/agent/service/AdminChatImportService.java:135) candidates | 72 | 导入候选识别及多种输入分支 |
| [AdminAgentController.java:116](/Users/initial/qoj/backend/src/main/java/com/qoj/module/agent/controller/AdminAgentController.java:116) streamChat | 68 | 请求与流式状态编排 |
| [AdminAgentMvcExchange.java:36](/Users/initial/qoj/backend/src/main/java/com/qoj/module/agent/service/AdminAgentMvcExchange.java:36) 构造器 | 54 | 手写 Servlet 请求/响应兼容 |
| [WebSocketAuthInterceptor.java:49](/Users/initial/qoj/backend/src/main/java/com/qoj/security/WebSocketAuthInterceptor.java:49) preSend | 49 | 多类认证与消息分支 |

ContestService.update 的 NPath 指标极高，但这是多个条件组合的静态路径估算，不代表运行会执行那么多分支。过多参数 32 条、过多字段 8 条、方法数 48 条均保留在原始清单。

**建议：** Agent 循环先明确状态不变量及可恢复 checkpoint；在现有类内分离“是否执行/审批判断”和“执行后记录”职责，避免继续套 Manager/Factory。不能仅把同一流程切成几十个一行方法来压低单方法指标。**风险：高。验收：** 审批暂停/恢复、拒绝/自定义要求、取消、断线、重复工具及持久化重启场景。

### S08 · 依赖默认 Locale 的大小写处理：22 处 · P2

PMD 与 SpotBugs 均识别到 22 处没有明确 Locale 的大小写转换，涉及 RedisKeys、认证、枚举/状态、URL 和访问范围。例如 [RedisKeys.java:57](/Users/initial/qoj/backend/src/main/java/com/qoj/common/redis/RedisKeys.java:57)、[SubmissionService.java:672](/Users/initial/qoj/backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:672)。

**建议：** 对协议、枚举、键名使用 Locale.ROOT；用户展示文字按实际语言需求判断。**风险：低至中。收益：** 避免部署默认语言影响机器字符串；先以土耳其语等 Locale 验证，不能直接将所有展示文本统一转换。

### S09 · 编译告警及杂项冗余 · P2/P3

165 条 javac 告警分类：unchecked 65、deprecation 37、removal 30、悬空 Javadoc 19、serial 9、try 5。

- 旧 ProblemVO 的 forRemoval 和 MyBatis selectBatchIds 的弃用仍在使用。前批复用组件解决了查询问题，未解决 API 迁移；应根据当前依赖 API 单列迁移，不能直接删除 DTO 或改变公开字段。
- unchecked 多见于测试的原始 Wrapper/Mockito 泛型；不能以 blanket SuppressWarnings 掩盖。
- serial 不仅是 serialVersionUID，AuthUser 还持有不可序列化实体字段。是否会使用 Session/序列化取决于运行方式，不能只补 UID 就宣称解决。
- 19 处 Javadoc 没附着声明，部分来自相邻文档注释；应删除或合并到真正声明，不做全仓格式化。
- PMD 另有不必要全限定名 39、装箱 4、强转 3、空字符串低效检查 6 等。通常低优先级，逐项核实后局部清理，不能与权限/性能改动混在一个大 diff。

## 二、12 组重复片段的处理建议

CPD 是 token 级相似性证据，不等于都应合并。完整位置见原始清单，主要类别：

- **值得进一步合并：** PracticePublicationService 与 PracticeService 的报告排名/VO 组装约 42 行；AdminDashboardService 的统计片段；JudgeQueueScheduler 两段判题配置/流程。必须先保留各自查询口径、失败处理与公开字段，不能把整个领域合并。
- **同构但权限边界应保留：** AdminSubmissionController 与 TeacherController 的列表/导出参数及调用；管理/公开队列 Controller。接口参数相同并不意味着应引入通用父 Controller。
- **局部重复，有差异：** ClassRoomService 与 StudentImportFileService.cleanText 对 null 分别返回 null 和空字符串，不能无差别替换。
- **可能必要：** AdminProblemVO record 的兼容构造器重复参数列表，需核对调用方；不以 CPD 告警为由破坏构造兼容。

## 三、已经核对、不能照工具建议直接删除的情况

1. **Agent 的两个 permit：** try-with-resources 不显式读取变量，但 close 负责释放 SandboxExecutionGuard 许可；PMD unused local/javac try 告警不是无用逻辑。SubmissionService 中同类资源亦然。
2. **Local HashMap：** 78 条 UseConcurrentHashMap 不能全量修。请求内取数 Map、只读快照不是共享可变状态，不应为了消告警改并发容器。
3. **DTO/实体字段：** SpotBugs 的 unread/unwritten public field 大量来自 Jackson/MyBatis 反射，不得删除其字段；EI_EXPOSE_REP/REP2 的大批集合暴露也需结合 DTO 契约判断。
4. **“已知 null”传给审计：** AccessPolicy 的匿名用户分支把 null 传给能处理匿名的 AuditLogger，NP_LOAD_OF_KNOWN_NULL_VALUE 不表示实际解引用空指针。
5. **COUNT 查询的 null 告警：** teacherDashboard 中 JdbcTemplate 的接口返回类型可空，但具体 `SELECT COUNT(*)` 无 GROUP BY 时会返回 0，不应统一包 Optional 造更多封装。
6. **资源告警：** LimitedWriter.close 是空实现；WebSocketSession 由连接生命周期管理，且拒绝用户时已有显式 close；AdminAgentMvcExchange 的 Writer 包内存输出流。没有据此确认文件句柄泄漏，不自动在业务方法结尾关闭活动 socket。
7. **业务异常栈：** 74 条 PreserveStackTrace 包含把非法输入转换成明确 BizException 的分支，不全部增加日志或把内部异常对外暴露。3 条 EmptyCatchBlock 也包含默认模板/配置容错，不能机械删 catch。
8. **密钥误报与真实配置风险分开：** XcpcioSecretCipher.keySpec 用注入 secret 的 SHA-256 结果构造 SecretKeySpec，规则所报位置不是常量 key。但构造参数存在可预测默认 secret 的回退，需独立验证缺配置启动策略；没有读取或展示真实密钥，不能宣称当前部署正在使用默认值。
9. **依赖分析误报：** Starter、MyBatis/Flyway、springdoc 等通过自动配置/服务发现消费；Maven “unused declared” 不构成删除证据。Caffeine 无直接源码使用仍是候选，需自动配置/依赖树证明。大量 used undeclared 来自 Spring Boot 约定的传递依赖，不应把几十个传递库全部手写进 POM。

## 四、待动态验证的正确性风险

- **WebSocket Session attributes 可空：** [WebSocketSubscriptionInterceptor.java:68](/Users/initial/qoj/backend/src/main/java/com/qoj/security/WebSocketSubscriptionInterceptor.java:68) 直接取 getSessionAttributes().get；某些分支已有非空保护而此分支没有。正常传输是否保证 headers，需要通过缺失/异常会话的 STOMP 场景验证后再决定加保护。
- **导出 code/codeLength 同时 null：** ContestInspectionExportService 中 int/Integer 三元表达式可能拆箱 null。当前已知 schema 的 code 是 NOT NULL，此前 E2E 已覆盖空代码；不能据字节码告警宣称正常数据库请求必现。需确认历史数据/其他调用路径后单列修复。
- **AI 返回值：** responseText 等对部分上游对象有空校验，对 getOutput 等进一步返回值没有完整防护。需构造空结果/异常响应测试；未调用真实外部模型，不把工具可空返回注解当作实际故障证据。
- **上传文件名：** 两个上传方法重复调用可空 getOriginalFilename；常规 Multipart 实现返回稳定值，因此工具可能保守误报。可先局部读取一次，避免重复调用及接口可空推理问题。
- **此前已记录风险仍存在：** 比赛状态遮罩的账号类型 ID 碰撞、XCPCIO 标记 finally 覆盖缺口等没有因静态检查通过而消失，见原审计及第 2 批报告。

## 五、建议执行顺序

1. **独立机械清理批次：** 29 个 import、确认无反射消费的私有方法、StandingAccumulator、7 个注入字段。保留编译与 Spring 启动验证；不要动外部 API。
2. **独立查询删除批次：** ACM/OI 未消费用户查询，按两种赛制比较完整榜单与 SQL；不要夹带排名算法重写。
3. **局部参数/变量清理：** 去无用绑定但保留 requireUsableProblems 校验；weekAcCount 等行为问题独立处理。
4. **协议 Locale、DTO/API 弃用迁移、异常与资源专项：** 每组有针对性的验证，不一次性“清零告警”。
5. **Agent 状态机复杂度：** 先补恢复/取消/审批 E2E，再沿已有职责拆解；不是简单换设计模式。

## 复跑与限制

```sh
python3 output/java-static-audit-2026-10-13/rerun.py
```

[复跑脚本](/Users/initial/qoj/output/java-static-audit-2026-10-13/rerun.py)、[51 条规则配置](/Users/initial/qoj/output/java-static-audit-2026-10-13/ruleset.xml)、两份工具专用 POM 均在 output 内，不修改项目 POM 或增加运行时依赖。脚本重新生成原始检查结果；本报告和整理后的 JSON/Markdown 属于本次快照，复跑后需重新归纳，不能自动套用旧统计。

[489 个源文件哈希](/Users/initial/qoj/output/java-static-audit-2026-10-13/source-sha256.json) 核对一致，本轮没有生产/测试源码改动。没有新增单元测试，未进行数据库、Redis、外部 HTTP 或 UI E2E。本次 177 项测试证明现有基线通过，不能替代待删查询的输出等价或新风险复现。

“所有情况”无法由有限规则证明穷尽。本轮覆盖后端 Java 的主要静态类别；未对所有 public API 做闭世界可达性证明，未完成每个事务/并发交错、每个依赖自动配置、全量安全/供应链扫描，也不包含前端 TypeScript。原始全量结果已交付，可按上述已确认清单继续处理，不能把未经人工复核的 752/929 条告警包装成同数量已确认问题。
