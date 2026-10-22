# OpenVuln 漏洞报告复核

> 此文保留修复前的复核快照。后续代码修复、动态验收与部署注意事项见
> [修复报告](openvuln-remediation-2026-10-19.md)，不要将下文“仍存在”视为修复后的状态。

日期：2026-10-19。对象：当前 `/Users/initial/qoj` 工作区，包含已有未提交修改。
输入：`/Users/initial/Downloads/openvuln-initial3366-droid-oj-full.md`。

## 结论与边界

14 条报告中，9 条的核心缺陷仍存在，2 条部分缓解，3 条已不适用。
其中 `BUG-R2-C1-A3-H1` 与 `BUG-R2-C1-A3-H2` 重复，不能计为两个独立根因。
按此口径，仍需处理的 11 条对应 10 项问题；认证相关问题适合集中修复。

本轮为源码和部署配置核查，没有修改业务代码、账号、数据库或 Redis。
检查时本机 18080 端口没有监听，未启动后端，未执行 HTTP E2E、爆破或判题耗尽测试。
“仍存在”指当前调用链可确认缺陷，不能理解为已在当前部署成功利用。
原报告的 CVSS、请求吞吐量、成功概率、停机时长和历史 PoC 成功状态没有重新验证。
仓库 nginx 中未发现登录限流，不能由此推断线上额外部署的 CDN/WAF 也没有防护。
附带的补丁仅作为待审材料，没有直接应用；尤其不宜用非原子的计数后删除替代完整验证码状态机。

## 逐项判定

下表 ID 均保留原报告的 `BUG-R2-` 前缀。

| ID | 当前判定 | 核查结果 |
| --- | --- | --- |
| C3-A1-H1 | 仍存在 | 重置密码的邮箱验证码错误分支没有计数、锁定或消费；其他三个消费入口同样缺失。发送前已写入有效验证码，SMTP 异常也不会回滚。 |
| C3-A2-H1 | 仍存在 | 新导入学生的用户名为学号，初始密码为学号末六位；公开资料仍返回用户名。仅影响仍使用该初始密码的账号。 |
| C3-A3-H1 | 仍存在 | 前台验证码按请求字段可选；只有用户名维度的失败锁定，没有看到来源或全局登录尝试预算。单独这一项不能证明必然接管账号。 |
| C3-A3-H2 | 仍存在 | 图形验证码错误时不消费、不累计失败次数，发放也没有通用限流；管理员、教师登录和发送邮件均受影响。破解验证码仍不等于知道密码。 |
| C3-A2-H2 | 部分缓解 | `/rank` 和快照接口已有服务层报名/所有者权限检查，匿名读取的原结论已失效；但 `/rank` 仍直接读实时缓存，未复用封榜策略。 |
| C3-A3-H3 | 仍存在 | 失败锁定仅绑定用户名，锁定检查先于密码核验；攻击者可阻止目标的新登录。锁定不会立即让已有会话退出。 |
| C3-A3-H4 | 仍存在 | 前台入口仍检查教师密码，正确时返回 `portal=TEACHER`；失败使用 `front` 计数而非 `teacher`。这是密码正确性探测，不直接签发教师 token。 |
| C3-A4-H3 | 部分缓解 | 改密后未撤销现有 token；前台、管理员密码登录已有固定 8 小时截止时间。教师登录、注册签发及旧 token 兼容路径仍可滚动续期。 |
| C1-A3-H1 | 仍存在 | GO_JUDGE 超时回收只检查领取时间；没有运行心跳、任务总预算或重试上限，可能重复领取仍在执行的任务。 |
| C1-A3-H2 | 仍存在，重复 | 与上一项为同一调度/SQL 根因，合并修复和验收。 |
| C1-A3-H3 | 仍存在，有前提 | 测试点顺序执行，单次非 AC 不终止全题；缺少提交总耗时预算和用户公平调度。危害依赖实际题目时限、测试点数量及判题容量。 |
| C2-A1-H2 | 当前不适用 | `CcpcojJudgeController` 与其 BCrypt worker 登录路由已移除。 |
| C2-A3-H1 | 当前不适用 | `CcpcojJudgeGatewayService`、`claimForCcpcoj` 等外部 worker 领取路径已移除。内嵌 GO_JUDGE 的同类问题仍见 C1-A3。 |
| C2-A1-H1 | 当前不适用 | 被报告的 CCPCOJ worker 登录限流实现已移除，不再有其代理共享预算与 INCR/EXPIRE 分支。 |

## 当前证据

路径均相对仓库根目录，行号对应本次核查时的文件。

### 1. 可推算的导入初始密码，优先级 P0

- `backend/src/main/java/com/qoj/module/classroom/service/ClassRoomService.java:704`：用户名设置为学号。
- 同文件 `:707`、`:1172`：新账号使用学号末六位生成密码；没有独立随机秘密。
- `backend/src/main/java/com/qoj/module/user/service/UserPublicService.java:32`：公开资料包含 `user.username`。
- `backend/src/main/java/com/qoj/config/SecurityConfig.java:141`：公开用户 API 放行。

公开用户名本身可以是正常产品设计；与可推算密码组合才使它变成认证风险。
只改未来导入逻辑不能修复已有账号。需要识别历史初始密码账号、撤销其会话，
通过可信渠道重新发放凭据。强制“登录后改密”不能阻止攻击者抢先首次登录。

### 2. 邮箱与图形验证码，优先级 P0/P1

- `backend/src/main/java/com/qoj/module/auth/service/AuthService.java:786`：重置密码仅 GET 后比较字符串，错误分支无尝试状态。
- 同文件 `:274`、`:675`、`:743`：注册、修改资料、绑定邮箱共享同一缺陷。
- `backend/src/main/java/com/qoj/module/auth/service/CaptchaService.java:124`：有效邮箱码在发送前写入 Redis。
- 同文件 `:179`：真实邮件发送在其后，抛错路径没有撤销已写入的码。
- 同文件 `:81`、`:297`：两个图形码验证入口均只在成功后删除，错误尝试可复用相同 ID。

建议将全部邮箱码消费入口集中到同一服务，原子地验证、计数、成功消费，
错误次数达到上限立即失效；同一个码不能因并发请求成功使用两次。
发行与发送失败也需明确定义状态，避免未成功交付的码继续有效。
图形码一次验证即消费，并限制发放和验证速率。
发送预算需要原子更新；当前“先 GET/检查、后 INCR/EXPIRE”不能保证并发配额。

### 3. 登录防护与教师密码探测，优先级 P1

- `backend/src/main/java/com/qoj/module/auth/controller/AuthController.java:55`：不传验证码字段就跳过图形码校验。
- `backend/src/main/java/com/qoj/module/auth/service/AuthService.java:114`：前台用户名锁定先于凭据校验。
- 同文件 `:134`：教师密码正确会返回可区分的教师入口响应，失败仍记在 `front` 域。
- 同文件 `:206`、`:220`：只有用户名计数，达到五次后拒绝该用户名后续新登录。
- `backend/src/main/java/com/qoj/module/auth/dto/FrontendLoginResponse.java:18`：教师入口响应没有 access/refresh token。
- 管理员、教师专用登录入口均强制图形码，但教师密码可以从前台探测。
- `docker/frontend/nginx.conf` 未配置 `limit_req`/`limit_conn`；当前过滤器和拦截器中未见通用认证请求限流。

教师探测仍受 `front` 的五次失败锁定，不能表述为每个教师可无限尝试。
跨入口需要统一认证尝试策略；前台不应核验教师密码来决定导航。
限流宜结合账号、可信来源、设备/全局预算，并提供恢复机制，避免纯用户名永久续锁造成拒绝服务。
校园共享 NAT 下，单一 IP 限流也可能误伤正常学生。

### 4. 改密未撤销会话，优先级 P1

- `backend/src/main/java/com/qoj/module/auth/service/AuthService.java:606`、`:762`、`:786`：教师改密、学生改密、重置密码只更新哈希。
- 同文件 `:331`：刷新验证 family、账户存在/状态等，未核对密码版本或凭据变更时间。
- `backend/src/main/java/com/qoj/security/JwtAuthenticationFilter.java:102`：access token 检查黑名单及账号状态，没有凭据版本校验。
- `backend/src/main/java/com/qoj/security/JwtService.java:50`：新前台/后台密码登录使用固定八小时 session 截止时间。
- `backend/src/main/java/com/qoj/module/auth/service/AuthService.java:420`：携带 `sessionExpiresAt` 的刷新不延长会话，但无该字段时仍走滚动续期。
- 同文件 `:167`：教师登录使用不携带固定截止时间的签发重载；注册也使用该类签发路径。

因此，“所有账号 token 都能无限延长”的原结论不再准确；“改密不使盗取会话失效”仍成立。
建议账户级凭据版本同时约束 access 和 refresh；所有密码写入路径统一更新，
并为旧 token 设计失效策略。只删除 online 状态不是撤销会话，过滤器会重新写入它。

### 5. 榜单匿名泄漏已拦截，但封榜仍有旁路，优先级 P1

- `backend/src/main/java/com/qoj/module/contest/controller/ContestRankController.java:57`、`:92`：两个旧入口均增加访问检查。
- `backend/src/main/java/com/qoj/module/contest/service/ContestService.java:1523`：要求所有者/超级管理员或已审核报名者，并校验比赛 IP 条件。
- 同文件 `:1076`：主 scoreboard 路径应用查看者封榜策略。
- `backend/src/main/java/com/qoj/module/contest/controller/ContestRankController.java:70`：旧 rank 路径直接调用实时排名服务。
- `backend/src/main/java/com/qoj/module/contest/service/ContestAcmRankService.java:268`、`ContestOiRankService.java:253`：直接读取排名缓存，不按 freezeTime 截断。
- `backend/src/main/java/com/qoj/module/contest/service/ContestRankTimePolicy.java`：入榜只约束比赛起止时间，不排除封榜期提交。
- `backend/src/main/java/com/qoj/module/submission/service/JudgeCallbackService.java:194`：判题回写实时排名缓存。

已审核选手可经过访问检查，因此应补齐旧 rank 入口的封榜规则。
快照读取还需要按快照类型、发布时间和查看者权限验收；本轮未证明存在可提前读取的 final 快照。
`publicScoreboardEnabled=false` 不应直接等同于禁止内部已报名者查看榜单。
本轮没有确认原报告关于匿名获取 studentNo 的链条仍成立。

### 6. 判题重复领取与任务耗时，优先级 P1

- `backend/src/main/java/com/qoj/module/judge/service/JudgeQueueScheduler.java:107`：先回收旧领取，再按数据库运行行数计算空位。
- `backend/src/main/java/com/qoj/module/submission/mapper/SubmissionMapper.java:132`：回收依据领取时间，增加 retry_count 但没有重试上限条件。
- `backend/src/main/java/com/qoj/module/judge/service/JudgeQueueScheduler.java:165`：完整判题返回前没有续租步骤。
- `backend/src/main/java/com/qoj/module/judge/gojudge/GoJudgeService.java:109`：顺序运行所有测试点，遇到非 AC 继续收集结果。
- 同文件 `:510`：单点 wall-clock 上限为 CPU 时限的三倍或 CPU 时限加两秒的较大值。
- `backend/src/main/java/com/qoj/module/judge/JudgeResourceLimits.java:17`：非 C/C++ 时限翻倍。
- `backend/src/main/java/com/qoj/module/setting/service/SystemSettingService.java:47`、`:51`：默认两并发、15 分钟回收。
- `backend/src/main/java/com/qoj/config/JudgeConfig.java:47`：固定线程池，等待队列 100；数据库行数不等于真实执行数量。
- `backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:225`：已有提交频率限制，不能约束单次判题总耗时或公平占用。

例如 30 个测试点、5 秒名义时限、非 C/C++ 的 wall-clock 预算可达约 900 秒，
加上编译和调度开销即可跨过默认回收阈值。语言倍率和逐点完整计分可以是正常 OJ 语义，
不宜直接删掉；应加入运行心跳/租约、领取代次、旧任务取消、总预算和公平调度。
同一进程的 workerId 会被重复使用，不能仅依赖 workerId 作为不同领取代次的唯一隔离标记。
原报告的队列饥饿时长没有在当前版本重现，不据此承诺必然永久宕机。

### 7. CCPCOJ 三条已不适用

当前源树不存在 `CcpcojJudgeController.java`、`CcpcojJudgeGatewayService.java`，
`SubmissionMapper` 中也没有 `claimForCcpcoj`。源码路由检索未发现 `judge_login`。
结论适用于本工作区重新构建的版本，不证明线上还在运行的旧镜像已经修复。

## 修复和验收顺序

1. 先消除导入密码可推算及历史账号风险；限制邮箱码猜测，统一图形码消费。
2. 统一各登录入口防护，移除教师密码探测，补改密撤销会话。
3. 让旧 rank 接口遵循相同封榜策略；补判题租约及领取代次，再处理任务预算和公平调度。
4. 对实际线上镜像、反向代理和题库配置复核，不能用本地源码代替线上状态。

实施前应先写出失败场景，再运行以专用账号为对象的 HTTP/浏览器 E2E：

- 错误邮箱码达到阈值后正确码也不可用；并发成功消费最多一次；注册、绑定、改资料、重置使用同一限制。
- SMTP 失败不遗留可消费码；图形码首次错误后不可复用；发放与发送配额在并发下不突破预算。
- 省略验证码字段不能绕过服务端挑战；跨前台/教师入口不能探测教师密码或分割失败预算。
- 单个来源不能持续锁死正常用户；共享出口的正常登录仍能完成。
- 学生、教师、管理员及批量重置后，旧 access/refresh token 全部按策略失效；固定会话截止时间不延长。
- 匿名、未报名、已报名、所有者、超级管理员分别检查封榜前后两个榜单 API 和快照读取。
- 受控延迟下活跃判题不被重领，模拟进程失联后可恢复；过期领取不能覆盖新结果，重试有界。
- 两个长任务不能无限阻塞另一用户；预算变更不破坏 OI 部分分、SPJ 和通信题结果。

E2E 应保留脱敏 HTTP 请求响应、时间线、数据库/Redis 前后状态、浏览器 trace 或截图，
测试退出时清理专用数据。本轮未执行以上动态验收，不把静态确认标为 E2E 通过。
