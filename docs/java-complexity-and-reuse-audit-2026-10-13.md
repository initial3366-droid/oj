# Java 复杂度与重复造轮子专项审核

审核日期：2026-10-13。基于前三批重构后的当前工作区，生产 Java 共 456 文件、41,327 行。全文检索目录、类型、工具实现和调用点，重点阅读 ZIP/CSV、题目 VO、比赛 Service、Agent 路由及 Servlet 适配代码。本轮仅审核，未修改生产代码。

## 结论

主要债务是**重复实现、职责混杂，以及 Agent 入口并存带来的适配规则重复**，不是普遍存在 Interface/Impl/Manager 层层包装。排除 Mapper 后只检索到 JudgeService、AgentClient 两个普通业务接口及 AdminApi 注解接口，不能据命名批量删接口。

13 个生产 Java 文件超过 500 行，4 个超过 1,000 行。长文件只是筛查信号，下述判断依据实际职责和重复实现；没有计算 AST 圈复杂度，不能把行数称为圈复杂度。

## 已确认的问题

### C01 · 手写 Servlet 请求/响应，承担框架兼容职责 · P1

**证据：** [AdminAgentMvcExchange.java:65](/Users/initial/qoj/backend/src/main/java/com/qoj/module/agent/service/AdminAgentMvcExchange.java:65) 用动态 Proxy 和大型 switch 模拟 HttpServletRequest/MultipartHttpServletRequest；响应也采用相同做法。未实现的方法由 defaultValue 返回默认值。155 行 `invoke` 直接调用 `RequestMappingHandlerAdapter.handle`，而非完整 Servlet/DispatcherServlet 分发。

**为什么复杂：** 188 行适配器需要自行维护请求属性、输入输出流、headers、编码、multipart、RequestContextHolder 和响应限额。它确实复用了 Spring 参数绑定与 HandlerAdapter，没有完全重写 MVC；但目标路由不会因此重新经过 FilterChain 和 HandlerInterceptor。项目恰有 [WebMvcConfig.java:40](/Users/initial/qoj/backend/src/main/java/com/qoj/config/WebMvcConfig.java:40) 注册的后台、维护模式及比赛 IP 拦截器，不能把调用方式描述为与普通 HTTP 请求全链路等价。外层 Agent 鉴权和方法安全仍可能生效，本轮没有证明越权漏洞。

**建议：** 暂停扩充仿 Servlet 能力，先为已有 Agent 功能明确边界：通用 API 功能若必须保留，单独验证其支持的 Servlet 行为和权限链；稳定的领域工作流优先直接复用现有业务服务。结合 C02 收敛入口后删除不再需要的模拟分支，不新增 Router/Manager/Adapter 链。不能简单移入生产 spring-test/MockMvc，也不能以普通反射直接调用替换 Spring 校验。

**风险：高。** 涉及审批、认证上下文、下载、multipart 和异常语义。**可验证收益：** 删除的自实现 Servlet 方法数、保留的功能 E2E 覆盖，以及普通后台与 Agent 目标操作的权限对照；不承诺运行速度提升。

### C02 · 通用后台 API 工具与专用 Agent 工具职责重叠 · P2

**证据：** [AdminChatAgentService.java:51](/Users/initial/qoj/backend/src/main/java/com/qoj/module/agent/service/AdminChatAgentService.java:51) 等工具分组既暴露 list/describe/read/write_admin_api，又暴露专用比赛、提交、人员、课程操作。[AdminAgentOperationsService.java:130](/Users/initial/qoj/backend/src/main/java/com/qoj/module/agent/service/AdminAgentOperationsService.java:130) 自行解释 operation、参数、权限并调业务服务；[AdminAgentApiService.java:174](/Users/initial/qoj/backend/src/main/java/com/qoj/module/agent/service/AdminAgentApiService.java:174) 为目录内 API 再做一套 schema、参数、凭据屏蔽与异常适配。AdminAgentApprovalPolicy.groupKey 还专门把专用 CRUD 与 API CRUD 归入同类审批。

**问题：** 同一业务可能需要同步维护工具描述、JSON 参数解释、后台 DTO、API 目录规则和审批映射。不是所有专用工具都可由 CRUD 取代，多步工作流仍有价值。

**建议：** 列出“工具→现有 Controller→Service”的能力矩阵；普通 CRUD 保留一个执行来源，专用工具只保留编排价值。保留现有外部工具契约时可先在内部统一执行，不能直接删除消费者正在调用的工具。不要继续给每个模块增加同构 OperationsService。

**风险：中至高。** Agent 功能与审批行为可观察。**收益：** 同一 CRUD 的参数/权限/审批维护点减少，按重复能力逐项计数；具体可删除数量待消费者矩阵验证。

### C03 · 测试点 ZIP 安全解析维护两套 · P1

**证据：** [ProblemDraftService.java:342](/Users/initial/qoj/backend/src/main/java/com/qoj/module/problem/service/ProblemDraftService.java:342) `parseZip` 与 [ProblemService.java:1312](/Users/initial/qoj/backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:1312) `parseZipTestCases` 重复实现上传/展开限额、entry 遍历、路径清洗、编号、重复检测、输入输出配对、public2 输入和进度。两类还各自维护 safeZipEntryName、readZipEntryText、caseNumber 与限额常量。

**问题：** JDK ZipInputStream 已被正确使用；真正的轮子是同一套领域安全策略重复两份，修补一边容易遗漏另一边。

**建议：** 保留一个题目域内的解析实现，返回现有 ProblemTestCaseRequest；持久化路径再转实体。Redis 草稿生命周期与数据库写入继续分开。保留扩展名检查、空 ZIP 文案等入口差异。确有两个消费者，共享解析有收益；无需创建通用 ImportFramework、策略工厂或 ZIP 工具库。

**风险：中。** 先做 ZIP 穿越/重复/限额/缺输出/通信题/进度 E2E。**收益：** 安全解析维护点 2→1，3 类重复 helper 各 2→1；不以删除行数作为唯一指标。

### C04 · 两套手写 CSV 解析已出现容错差异 · P2

**证据：** [StudentImportFileService.java:197](/Users/initial/qoj/backend/src/main/java/com/qoj/module/classroom/service/StudentImportFileService.java:197) 逐物理行读取后交给 parseCsvLine；[ContestRosterFileService.java:62](/Users/initial/qoj/backend/src/main/java/com/qoj/module/contest/service/ContestRosterFileService.java:62) csvRow 重复实现引号状态机。后者拒绝未闭合引号、限制 50 列，前者的行解析没有这两个检查；两者按 readLine 分割，均没有完整支持带换行的引号字段。

**建议：** 先确认产品支持的 CSV 子集和原异常行为，统一一个读取实现；文件大小、表头与业务字段校验保留在各入口。POM 未直接声明 CSV 专用解析依赖；当前 POI 使用解决的是 Excel，不应声称它已替代 CSV 解析。若需要完整 CSV 语法，再独立论证成熟依赖，不能仅凭传递依赖可见就引入调用。

**风险：中。** 统一校验或支持跨行字段会改变行为，需单列正确性改动。**收益：** 字段解析维护点 2→1，两个入口对同一合法/非法文件的行为可对照。

### C05 · 题目展示转换重复且夹带查询 · P2

**证据：** [ProblemService.java:826](/Users/initial/qoj/backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:826) toAdminVO 与 871 行 toAdminVOForUpdate 重复传入数十个字段，并分别查询样例、隐藏测试点、文件夹及专业；同时存在旧 ProblemVO、PublicProblemVO、AdminProblemVO 转换和 withAttemptStatus 重建。

**问题：** 相同字段更改容易漏改转换点；IO 隐藏在转换里，列表产生 N+1。更新响应有意保留不同统计/作者值，不能直接改成调用完整 toAdminVO，也不能把公开/管理 DTO 合并导致字段泄漏。

**建议：** 先按已有 A01 把列表取数移出转换；仅共享真正相同的组装。对旧 ProblemVO 做消费者迁移，完成后删除旧转换分支。不要新增映射框架，避免包含大量布尔开关的通用 toVO。

**风险：中。** 字段与权限敏感。**收益：** 重复组装维护点减少；查询收益通过完整请求计数，不用源码推导冒充实测。

### C06 · 连续训练日期算法完全重复 · P2

**证据：** [LeaderboardService.java:282](/Users/initial/qoj/backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:282) trainingStreak 与 [UserScoreService.java:64](/Users/initial/qoj/backend/src/main/java/com/qoj/module/user/service/UserScoreService.java:64) computeTrainingStreak 均读取首次 AC 日期，转 Set，从今天/昨天向前遍历。

**建议：** 归入已有分数领域能力，复用一份计算；若后续批量取日期，查询与计算分开，直接接收日期集合及日期基点。无需新增日期工具库。不能改读持久化 streak 替代实时计算。

**风险：低至中。** 今天未训练、跨日、重复日期和断档需验证。**收益：** 算法维护点 2→1；是否减少 SQL 取决于 A05 的批量读取，单纯去重不承诺。

### C07 · 无静态消费者的 RestClient Bean 与噪声注释 · P3

**证据：** [AppConfig.java:40](/Users/initial/qoj/backend/src/main/java/com/qoj/config/AppConfig.java:40) restClient Bean 的类型与名称在生产源码只出现于该文件；注释却称用于判题/代理服务。约 895 行匹配“封装…相关逻辑/保持该职责的输入、输出/构造…保存”等模板文本，private 构造方法和单个 return 也重复描述。

**建议：** 核对运行时按名消费后删 Bean；随相关业务改动局部删除无信息量注释。保留协议、安全、事务和并发约束。不为清注释做全项目格式化。

**风险：低，Bean 动态消费未排除。** **收益：** 删除无效配置/说明，减少错误导航；没有可证明性能收益。

## 复杂度较高，但尚不能判定为多余实现

- **ContestService 3,225 行、ClassRoomService 1,183 行：** 已确认承担多个职责，但不能凭行数决定拆成几个类。ContestService 已有导出、排名、快照、滚榜领域组件，应先迁移到现有边界，避免再增加 Manager/Helper。ACM/OI 实时榜与缓存排名的重建路径不同，不能看到算法相似就强行合一。
- **两套 CSV 输出 helper：** SubmissionExportService.csv 会把 CR/LF 替换为空格；ContestInspectionExportService.csv 保留换行。确有重复转义/BOM，但行为不等价，仅几十行且没有成熟 CSV 直依赖，不优先增加 UniversalCsvUtils。
- **Caffeine：** POM 有直接依赖，生产源码未检索到直接 API/CacheManager 消费；运行时自动配置和依赖用途尚未排除。不能直接删除，也不能为了使用它替换有跨进程含义的 Redis 缓存。
- **IpNetworkUtils、Utf8TextLimiter：** 前者包含拒绝 DNS 解析输入、无效规则拒绝等业务约束；后者按 UTF-8 字节截断且不切断字符。不能用 String.substring、简单 InetAddress.getByName 或几行通用工具盲替。
- **JudgeService、AgentClient、Mapper：** 有领域契约、默认行为或框架代理用途；本轮没有确认可安全删除的 Interface/Impl 配对。AdminStudentImportService 还承担事务和逐行结果编排，不是单纯 Service 转发。
- **静态 ObjectMapper：** 固定实例不等于每请求创建；合并必须核对配置与静态调用边界，不能仅因为看到 new 就认定造轮子。

## 对前三批改动的复核

三批优先解决 IO 放大，不能据此宣称代码复杂度已显著下降。SubmissionViewData 是请求内取数结果，SubmissionCaseSummary 是五列 SQL 投影，有明确消费者；未新增框架或接口层。但 SubmissionService 仍超过 1,200 行，应继续清理现有职责。

三个 E2E 脚本重复了临时数据库/Redis/后端启动基础设施。这是新增加的维护重复，后续扩充前宜复用一个测试支持模块，只统一资源生命周期，保持场景与断言独立；不要把业务断言做成泛用测试 DSL。本轮未重写已通过的脚本。

## 推荐顺序与验证边界

1. **先收敛重复实现：C03 ZIP、C06 streak。** 前者安全维护收益高，后者范围小；各自独立 diff，先列失败场景并写 E2E。
2. **再处理 C04 CSV、C05 题目组装/旧 DTO。** 先固定输入/输出差异，把正确性修复与纯重构分开。
3. **C01/C02 作为独立 Agent 边界专项。** 先做能力矩阵和权限链对照，不立即推倒重写，不调用外部模型就能先验证内部执行链。
4. **局部清理 C07，按已存在职责迁移长类。** 不新增抽象层来掩盖复杂度。

本轮只读取源码并保存报告与[源文件哈希清单](/Users/initial/qoj/output/java-complexity-audit/source-sha256.json)，未修改生产代码、依赖、数据库或测试。未运行新的构建、E2E、静态分析器或性能测试；前三批 177 项测试和 E2E 结果只证明各自改动范围，不能用于宣称本次新发现已经动态复现或修复。
