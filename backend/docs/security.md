# QOJ 安全说明

本文档详细说明 QOJ 在线评测系统的安全设计，涵盖判题隔离、JWT 认证、权限模型、数据隔离等核心安全机制。

---

## 目录

1. [为什么不能裸跑用户代码](#1-为什么不能裸跑用户代码)
2. [Docker Judge 的限制](#2-docker-judge-的限制)
3. [JWT 安全](#3-jwt-安全)
4. [权限模型](#4-权限模型)
5. [私有题目防泄露](#5-私有题目防泄露)
6. [比赛数据隔离](#6-比赛数据隔离)
7. [提交代码查看权限](#7-提交代码查看权限)

---

## 1. 为什么不能裸跑用户代码

在线评测系统的核心安全风险在于：**系统需要执行不可信的用户代码**。如果直接在主服务器进程中执行用户提交的代码（即"裸跑"），将带来灾难性后果。

### 1.1 裸跑的具体风险

| 风险类别 | 攻击示例 | 后果 |
|---------|---------|------|
| **文件系统访问** | `open("/etc/passwd")`、读取数据库配置 | 泄露服务器敏感文件、JWT 密钥、数据库密码 |
| **任意命令执行** | `system("rm -rf /")`、`Runtime.exec()` | 删除服务器数据、植入后门 |
| **网络连接** | 反向 Shell、向内网发起请求 | 服务器被远程控制、SSRF 攻击 |
| **资源耗尽** | `while(true){}`、`fork` 炸弹、申请超大内存 | 拖垮主服务，影响所有用户（DoS） |
| **进程提权** | 利用系统漏洞获取 root 权限 | 完全控制服务器 |
| **数据窃取** | 读取其他用户的提交、测试数据 | 题目答案泄露、隐私泄露 |

### 1.2 真实案例的代价

用户代码与主服务运行在同一进程/主机时：
- 用户代码可以读取 `application.yml` 中的 `JWT_SECRET`，从而伪造任意用户的登录态
- 用户代码可以直接连接数据库，绕过所有业务层权限检查，篡改成绩
- 一个死循环就能占满 CPU，让整个评测系统宕机

### 1.3 QOJ 的处理策略

QOJ 中存在 `LocalJudgeService`，它在主服务器直接执行用户代码，**仅用于本地开发测试**：

```java
@Service
@ConditionalOnProperty(name = "qoj.judge.enable-unsafe-local-judge", havingValue = "true")
@Deprecated(since = "0.2.0", forRemoval = true)
public class LocalJudgeService {
    // ⚠️ 严重安全警告：在主服务器直接执行用户代码，无任何沙箱隔离
}
```

**安全保障**:
- ✅ 默认禁用（`@ConditionalOnProperty` 要求显式配置 `enable-unsafe-local-judge=true`）
- ✅ 标记 `@Deprecated(forRemoval = true)`，明确不应在生产使用
- ✅ 类注释包含醒目的安全警告

**生产环境必须使用**:
- **DOMjudge 远程判题**（推荐）
- **Docker 隔离判题**

---

## 2. Docker Judge 的限制

生产环境必须将用户代码放入隔离的沙箱中执行。QOJ 推荐使用 DOMjudge（其底层基于 Linux cgroup + chroot/容器隔离），或自建 Docker 判题 Worker。

### 2.1 隔离原则

判题容器必须遵循"最小权限 + 完全隔离"原则：

```yaml
judge-worker:
  image: qoj/judge-worker
  # 1. 网络隔离：禁止任何网络访问
  network_mode: none

  # 2. 只读根文件系统
  read_only: true

  # 3. 删除所有 Linux capabilities
  cap_drop:
    - ALL

  # 4. 禁止提权
  security_opt:
    - no-new-privileges:true

  # 5. 资源限制
  mem_limit: 256m          # 内存上限
  memswap_limit: 256m      # 禁止使用 swap
  cpus: 1.0                # CPU 限制
  pids_limit: 64           # 防止 fork 炸弹

  # 6. 临时可写目录（执行结束即销毁）
  tmpfs:
    - /workspace:size=64m,mode=1777
```

### 2.2 必须强制的限制项

| 限制项 | 机制 | 防御目标 |
|--------|------|---------|
| **CPU 时间** | 评测器 `setrlimit(RLIMIT_CPU)` / cgroup | 死循环、超时程序 |
| **真实时间(wall time)** | 外部 watchdog 强制 kill | sleep 阻塞、IO 等待 |
| **内存** | cgroup `mem_limit` + `setrlimit(RLIMIT_AS)` | 内存炸弹 |
| **进程/线程数** | `pids_limit` | fork 炸弹 |
| **文件大小** | `setrlimit(RLIMIT_FSIZE)` | 写满磁盘 |
| **网络** | `network_mode: none` | 反向 Shell、SSRF、外部通信 |
| **文件系统** | 只读根 + 临时 tmpfs | 篡改系统文件、持久化后门 |
| **系统调用** | seccomp 白名单 | 危险 syscall（如 `ptrace`、`mount`） |
| **运行用户** | 非 root 低权限用户（如 `nobody`） | 提权 |

### 2.3 一次性容器

- 每次判题使用**全新容器**或**全新临时目录**，判题结束立即销毁
- 防止上一次提交的残留文件影响下一次判题
- 防止用户代码在容器间留下持久化痕迹

### 2.4 Docker 并非绝对安全

Docker 共享宿主机内核，存在内核漏洞逃逸的可能。更高安全要求场景应考虑：
- **gVisor**（用户态内核，syscall 拦截）
- **Kata Containers / Firecracker**（轻量级虚拟机隔离）
- 物理隔离的独立判题机

---

## 3. JWT 安全

QOJ 使用 JWT（HS512 签名）实现无状态认证，并通过多重机制防范常见的 Token 攻击。

### 3.1 双 Token 机制

| Token 类型 | 有效期 | 用途 |
|-----------|--------|------|
| **Access Token** | 15 分钟 | 访问业务接口 |
| **Refresh Token** | 7 天 | 刷新获取新的 Access Token |

短 Access Token 有效期可显著缩小 Token 被盗后的攻击窗口。

### 3.2 JWT_SECRET 强制校验

在 `QojProperties` 中通过 `@PostConstruct` 校验密钥强度：

```java
@PostConstruct
public void validate() {
    int secretLength = jwt.secret.getBytes(StandardCharsets.UTF_8).length;
    boolean isProduction = "prod".equalsIgnoreCase(activeProfile);

    if (secretLength < 32 && isProduction) {
        throw new IllegalStateException("【生产环境启动失败】JWT_SECRET 长度不足");
    }
}
```

- HS512 算法要求密钥至少 64 字节
- 生产环境密钥过短直接拒绝启动，避免弱密钥被暴力破解

### 3.3 Token 轮换（Rotation）

每次使用 Refresh Token 刷新时：
1. 颁发**新的** Access Token 和 Refresh Token
2. 旧的 Refresh Token 立即失效（加入黑名单）
3. 同一 Token 族群（family）共享一个 `familyId`

### 3.4 重放攻击检测

如果一个已被使用过（轮换过）的 Refresh Token 再次被使用：
- 说明该 Token 可能已被窃取（攻击者和合法用户同时持有）
- 系统会**作废整个 Token 族群**，强制该用户重新登录
- 通过 Redis 中的 `familyId` 追踪实现

### 3.5 双黑名单机制

Redis 中维护两类黑名单：

```java
RedisKeys.refreshTokenBlacklist(jti)   // Refresh Token 黑名单
RedisKeys.refreshTokenFamily(familyId) // Token 族群追踪
```

- **登出**：同时撤销 Access Token 和 Refresh Token
- **黑名单 TTL**：与 Token 剩余有效期一致，自动过期清理，避免 Redis 无限增长

### 3.6 传输与存储安全

- 生产环境必须使用 **HTTPS**，防止 Token 在传输中被嗅探
- 前端存储于 `localStorage`（`qoj.accessToken`）
- 后端无状态校验，签名验证 + 黑名单查询

---

## 4. 权限模型

QOJ 采用**三层纵深防御**的权限检查架构，任何一层都能独立拦截越权请求。

### 4.1 三层权限检查

```
用户请求
  ↓
┌─────────────────────────────────────────────┐
│ Layer 1: SecurityConfig（URL 级别）            │
│ - 拦截 URL 路径，校验角色                       │
│ - /api/admin/v1/users/** → SUPER_ADMIN         │
│ - /api/admin/v1/**       → 管理员角色           │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Layer 2: @PreAuthorize（Controller 级别）      │
│ - 方法/类级别角色校验                           │
│ - @PreAuthorize("hasAnyRole('SUPER_ADMIN',    │
│    'TEACHER','CLUB_ADMIN')")                   │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Layer 3: AccessPolicy（资源级别）              │
│ - 校验资源所有权（是否本人创建）                 │
│ - ProblemAccessPolicy / ContestAccessPolicy 等 │
└─────────────────────────────────────────────┘
  ↓
业务逻辑
```

### 4.2 角色定义

| 角色 | 说明 | 权限范围 |
|------|------|---------|
| `SUPER_ADMIN` | 超级管理员 | 所有资源 |
| `TEACHER` | 教师 | 自己创建的题目/比赛/练习 + 班级学生 |
| `CLUB_ADMIN` | 社团管理员 | 自己创建的比赛 + 社团成员 |
| `STUDENT` | 学生 | 公开资源 + 自己的提交 |
| `GUEST` | 访客 | 仅公开资源 |

### 4.3 SecurityConfig URL 规则

```java
.requestMatchers("/api/v1/auth/login", "/register", "/refresh").permitAll()
.requestMatchers(HttpMethod.GET, "/api/v1/problems/**").permitAll()
.requestMatchers(HttpMethod.GET, "/api/v1/contests/**").permitAll()
.requestMatchers("/api/admin/v1/users/**").hasRole("SUPER_ADMIN")
.requestMatchers("/api/admin/v1/**").hasAnyRole("SUPER_ADMIN", "TEACHER", "CLUB_ADMIN")
.anyRequest().authenticated()
```

### 4.4 AccessPolicy 资源所有权

每种资源都有独立的 AccessPolicy 实现，定义细粒度权限：

- `ProblemAccessPolicy` - VIEW / CREATE / UPDATE / DELETE / VIEW_HIDDEN_CASE
- `ContestAccessPolicy` - VIEW / SUBMIT / MANAGE_REGISTRATION / MANAGE_SCOREBOARD / REJUDGE
- `PracticeAccessPolicy` - 练习权限
- `SubmissionAccessPolicy` - VIEW / VIEW_CODE / REJUDGE
- `ScoreboardAccessPolicy` - 榜单查看权限

所有敏感操作（DELETE / REJUDGE）通过 `AuditLogger` 记录审计日志。

---

## 5. 私有题目防泄露

非公开题目（`is_public = false`）的题面、测试数据绝不能泄露给无权用户。

### 5.1 题目可见性规则（ProblemAccessPolicy.canView）

```java
private boolean canView(AuthUser user, Problem problem) {
    // 1. 公开题目任何人可见
    if (Boolean.TRUE.equals(problem.isPublic)) {
        return true;
    }
    // 2. 未登录用户不能查看非公开题目
    if (user == null) {
        return false;  // 记录审计日志
    }
    // 3. 超级管理员可以查看所有题目
    if (isSuperAdmin(user)) {
        return true;
    }
    // 4. 题目创建者可以查看自己的题目
    if (problem.ownerId != null && problem.ownerId.equals(user.id())) {
        return true;
    }
    // 5. 其他情况一律拒绝
    return false;  // 记录审计日志
}
```

### 5.2 测试数据隔离

- 隐藏测试用例（`sample = false`）仅 `VIEW_HIDDEN_CASE` 权限可见（超管 + 题目创建者）
- 普通用户提交后**只能看到测试点状态**（AC/WA/TLE），看不到测试数据内容
- 题目列表查询在 SQL 层即过滤：`WHERE is_public = TRUE AND is_deleted = FALSE`（有复合索引 `idx_problems_public_deleted`）

### 5.3 防止越权遍历

- 直接访问 `/api/v1/problems/{id}` 时，Service 层调用 AccessPolicy 校验
- 非公开题目对无权用户返回 403，**不区分"不存在"和"无权限"**以避免信息泄露（推荐）

---

## 6. 比赛数据隔离

比赛系统涉及封榜、私有受众、进行中防作弊等复杂场景，数据隔离至关重要。

### 6.1 比赛可见性（ContestAccessPolicy.canView）

```java
// ALL（公开） → 任何人可见
// 否则需要：超管 / 创建者 / 在目标受众（班级/社团）中
```

比赛 `audience` 字段：`ALL`（全校）/ `CLASS`（指定班级）/ `CLUB`（指定社团）。

### 6.2 比赛题目时间窗口（canViewProblemDetail）

```java
// 比赛未开始：只有超管和创建者能提前查看题目
if (now.isBefore(contest.startTime)) {
    return isSuperAdmin(user) || isOwner(...);
}
// 比赛开始后：需要有查看比赛的权限（在目标受众中）
```

**防止赛前泄题**：比赛开始前，普通参赛者无法查看题目内容。

### 6.3 比赛题目快照

- `contest_problems` 表存储题目内容的**独立快照**（含题面副本）
- 即使原题目在题库中被修改/删除，比赛中的题目内容保持不变
- 防止比赛进行中题目被篡改

### 6.4 提交权限（canSubmit）

```java
// 1. 必须在比赛时间窗口内（startTime ~ endTime）
// 2. 超级管理员和创建者不能提交（防止刷榜）
// 3. 后台账号不能提交
// 4. 必须已报名（Service 层校验）
```

### 6.5 封榜期榜单隔离（canViewScoreboardDuringFreeze）

封榜（freeze）后到比赛结束前：
- 普通参赛者看到的是**冻结时刻的榜单快照**
- 只有超管和创建者能查看实时榜单
- 通过 `ContestScoreboardSnapshot`（FROZEN/FINAL/CUSTOM 快照）实现

### 6.6 防作弊

- `tab_switch_logs` 记录参赛者切屏行为
- `antiCheatEnabled` / `maxSwitches` 控制切屏次数限制
- `allowFullscreen` 强制全屏模式

---

## 7. 提交代码查看权限

提交的源代码属于敏感数据 —— 在比赛中泄露他人代码等同于作弊，必须严格控制。

### 7.1 基本信息 vs 代码

`SubmissionAccessPolicy` 区分两种权限：

| 权限 | 内容 | 规则 |
|------|------|------|
| `VIEW` | 状态、语言、耗时、内存 | 任何人可见 |
| `VIEW_CODE` | **源代码** | 严格限制 |

### 7.2 代码查看规则（canViewCode）

```java
public boolean canViewCode(AuthUser user, Submission submission) {
    if (user == null) {
        return false;  // 未登录拒绝
    }
    // 1. 超级管理员可以查看所有提交代码
    if (isSuperAdmin(user)) {
        return true;
    }
    // 2. 用户可以查看自己的提交代码
    if (submission.userId.equals(user.id())) {
        return true;
    }
    // 3. 其他情况拒绝（记录审计日志）
    return false;
}
```

### 7.3 比赛场景的特殊规则

| 场景 | 能否查看他人代码 |
|------|----------------|
| 比赛进行中 | ❌ 任何人都不能查看他人代码（防作弊） |
| 比赛结束后 | ✅ 教师 / 比赛创建者可查看（需 Service 层配合 Contest 数据判断） |
| 普通（非比赛）提交 | 教师可查看本班级学生提交（Service 层校验班级关系） |

> 说明：比赛相关的细粒度规则（如"比赛结束后教师可看"）需要在 Service 层结合 `Contest` 和班级/社团数据判断，AccessPolicy 提供基础校验。

### 7.4 管理端代码查看（AdminSubmissionController）

```java
GET /api/admin/v1/submissions/{id}/code
```

- 超级管理员：可查看所有提交代码
- 其他管理员（TEACHER/CLUB_ADMIN）：当前仅校验角色，细粒度所有权检查标记为 TODO（应只能查看自己创建的比赛/练习中的提交）

### 7.5 重判权限（canRejudge）

```java
private boolean canRejudge(AuthUser user, Submission submission) {
    // 只有超级管理员可以重判（记录敏感操作审计日志）
    return isSuperAdmin(user);
}
```

重判属于敏感操作，通过 `AuditLogger.checkAndLogSensitive` 记录完整审计日志。

---

## 附录：安全检查清单

部署前请确认：

- [ ] `JWT_SECRET` 为至少 64 字节的随机值
- [ ] `qoj.judge.enable-unsafe-local-judge` 未启用（生产环境）
- [ ] 判题使用 DOMjudge 或隔离的 Docker Worker
- [ ] 判题容器配置了网络隔离、资源限制、只读文件系统
- [ ] 生产环境启用 HTTPS
- [ ] CORS `allowedOrigins` 配置为可信域名，非通配符
- [ ] 数据库、Redis 配置了强密码且不对公网开放
- [ ] 审计日志（AuditLogger）正常记录敏感操作

---

**文档版本**: 1.0
**最后更新**: 2026-06-13
