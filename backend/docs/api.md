# QOJ API 接口文档

本文档描述 QOJ 在线评测系统的 REST API 接口。

---

## 通用约定

### Base URL

- 开发环境: `http://localhost:8080`
- 用户端 API 前缀: `/api/v1`
- 管理端 API 前缀: `/api/admin/v1`

### 统一响应格式

所有接口返回统一的 JSON 结构：

```json
{
  "code": 200,
  "message": "成功",
  "data": { }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | 业务状态码（见错误码表） |
| `message` | string | 提示信息 |
| `data` | T | 业务数据，可为对象、数组或 null |

### 分页响应

列表接口返回 `PageResult` 结构：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "records": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

### 认证方式

需要认证的接口在请求头携带 JWT：

```
Authorization: Bearer <accessToken>
```

### 错误码

| code | 说明 | HTTP 状态 |
|------|------|-----------|
| 200 | 成功 | 200 |
| 40000 | 请求参数错误 | 400 |
| 40001 | 未登录或登录已过期 | 401 |
| 40003 | 无权限 | 403 |
| 40004 | 资源不存在 | 404 |
| 40009 | 资源冲突 | 409 |
| 42900 | 请求过于频繁 | 429 |
| 50000 | 系统错误 | 500 |
| 50001 | 判题服务异常 | 500 |
| 50100 | 功能尚未实现 | 501 |

---

## 1. 认证 Auth

### POST /api/v1/auth/login
用户登录。

**请求体**:
```json
{ "username": "student01", "password": "******" }
```

**响应**:
```json
{
  "code": 200,
  "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
}
```

### POST /api/v1/auth/register
用户注册。

**请求体**:
```json
{
  "username": "student01",
  "displayName": "张三",
  "className": "软件工程 2401",
  "studentNo": "2024032108",
  "email": "zhangsan@example.com",
  "password": "******"
}
```

### POST /api/v1/auth/refresh
刷新 Token（Token 轮换，旧 Refresh Token 失效）。

**请求体**:
```json
{ "refreshToken": "eyJ..." }
```

**响应**: 返回新的 `accessToken` 和 `refreshToken`。

### POST /api/v1/auth/logout
登出（撤销 Access + Refresh Token）。**需认证**。

### GET /api/v1/auth/me
获取当前登录用户信息。**需认证**。

---

## 2. 题目 Problems

### GET /api/v1/problems
题目列表（公开）。支持分页和筛选。

**查询参数**: `page`, `pageSize`, `difficulty`, `tag`, `keyword`

### GET /api/v1/problems/{id}
题目详情。非公开题目需要权限（创建者/超管）。

### POST /api/v1/problems
创建题目。**需 TEACHER / SUPER_ADMIN**。

### PUT /api/v1/problems/{id}
更新题目。**需创建者 / SUPER_ADMIN**。

### DELETE /api/v1/problems/{id}
删除题目（软删除）。**需创建者 / SUPER_ADMIN**。

### POST /api/v1/problems/{id}/testdata
上传测试数据。**需创建者 / SUPER_ADMIN**。

### PATCH /api/v1/problems/{id}/publish
发布/取消发布题目。**需创建者 / SUPER_ADMIN**。

---

## 3. 比赛 Contests

### GET /api/v1/contests
比赛列表（公开）。

### GET /api/v1/contests/{id}
比赛详情。非公开比赛需要在目标受众中。

### POST /api/v1/contests/{id}/register
报名比赛。**需认证**。

### GET /api/v1/contests/{id}/registration-options
获取报名选项（身份/范围）。

### GET /api/v1/contests/{id}/problems/{contestProblemId}
查看比赛题目详情。比赛开始前仅创建者/超管可见。

### GET /api/v1/contests/{id}/scoreboard
查看比赛榜单。封榜期间普通用户看冻结快照。

### GET /api/v1/contests/{contestId}/rank
获取比赛排名（ACM/OI）。

### GET /api/v1/contests/{contestId}/scoreboard/snapshot/{type}
获取榜单快照（FROZEN / FINAL / CUSTOM）。

---

## 4. 练习 Practices

### GET /api/v1/practices
练习列表（公开）。

### GET /api/v1/practices/{id}
练习详情。

---

## 5. 提交 Submissions

### POST /api/v1/submissions
提交代码。**需认证**。

**请求体**:
```json
{
  "problemId": 1001,
  "contestId": null,
  "language": "cpp",
  "code": "#include <iostream>..."
}
```

### GET /api/v1/submissions
提交列表。支持按 `problemId`、`contestId`、`language`、`status`、`userId` 筛选。

**查询参数**: `page`, `pageSize`, `problemId`, `contestId`, `language`, `status`, `userId`

### GET /api/v1/submissions/{id}
提交详情。**代码内容仅本人/超管可见**（见 [security.md](security.md)）。

---

## 6. 在线运行 Sandbox

### POST /api/v1/sandbox/run
自定义输入运行代码（不计入提交）。**需认证**。

**请求体**:
```json
{
  "language": "python",
  "code": "print(input())",
  "input": "hello",
  "timeLimit": 2000,
  "memoryLimit": 256
}
```

---

## 7. 首页 Home

### GET /api/v1/home
获取首页配置（每日一题、轮播图、近期比赛）。公开。

---

## 8. 排行榜 Leaderboard

### GET /api/v1/leaderboard/global
全站排行榜。公开。

### GET /api/v1/leaderboard/class/{id}
班级排行榜。

### GET /api/v1/leaderboard/club/{id}
社团排行榜。

---

## 9. 班级 Classes

### GET /api/v1/classes
班级列表。**需认证**。

### GET /api/v1/classes/{id}
班级详情。

### POST /api/v1/classes
创建班级。**需 TEACHER / SUPER_ADMIN**。

### POST /api/v1/classes/{id}/members
添加班级成员。

### POST /api/v1/classes/{id}/members/import
批量导入成员。

### DELETE /api/v1/classes/{id}/members/{userId}
移除成员。

### POST /api/v1/classes/join
通过邀请码加入班级。

---

## 10. 社团 Clubs

### GET /api/v1/clubs
社团列表。

### GET /api/v1/clubs/{id}
社团详情。

### POST /api/v1/clubs
创建社团。

### POST /api/v1/clubs/{id}/members
添加社团成员。

### PATCH /api/v1/clubs/{id}/members/{userId}/role
修改成员角色。

### DELETE /api/v1/clubs/{id}/members/{userId}
移除成员。

### POST /api/v1/clubs/join
通过邀请码加入社团。

---

# 管理端 API

所有 `/api/admin/v1/*` 接口需要管理员角色，遵循三层权限检查。

## 仪表盘

### GET /api/admin/v1/dashboard
统计数据（在线人数、用户数、提交数等）。**需管理员**。

## 用户管理（仅 SUPER_ADMIN）

```
GET    /api/admin/v1/users        # 列表
POST   /api/admin/v1/users        # 创建
PUT    /api/admin/v1/users/{id}   # 更新
DELETE /api/admin/v1/users/{id}   # 删除
```

## 题目管理

```
GET    /api/admin/v1/problems                       # 列表
GET    /api/admin/v1/problems/{id}                   # 详情
PUT    /api/admin/v1/problems/{id}                   # 更新
DELETE /api/admin/v1/problems/{id}                   # 删除
GET    /api/admin/v1/problems/{id}/test-cases        # 测试用例列表
POST   /api/admin/v1/problems/{id}/test-cases        # 添加测试用例
PUT    /api/admin/v1/problems/{id}/test-cases/{tid}  # 更新测试用例
DELETE /api/admin/v1/problems/{id}/test-cases/{tid}  # 删除测试用例
POST   /api/admin/v1/problems/{id}/test-cases/zip    # 批量上传
```

## 题目草稿

```
POST   /api/admin/v1/problem-drafts                       # 创建草稿
GET    /api/admin/v1/problem-drafts/{draftId}             # 获取草稿
PUT    /api/admin/v1/problem-drafts/{draftId}/basic       # 更新基本信息
PUT    /api/admin/v1/problem-drafts/{draftId}/test-cases  # 更新测试用例
POST   /api/admin/v1/problem-drafts/{draftId}/test-cases/zip  # 批量上传
POST   /api/admin/v1/problem-drafts/{draftId}/commit      # 提交发布
```

## 比赛管理

```
GET    /api/admin/v1/contests                              # 列表
POST   /api/admin/v1/contests                              # 创建
GET    /api/admin/v1/contests/{id}                         # 详情
PUT    /api/admin/v1/contests/{id}                         # 更新
DELETE /api/admin/v1/contests/{id}                         # 删除
GET    /api/admin/v1/contests/draft                        # 获取草稿
PUT    /api/admin/v1/contests/draft                        # 更新草稿
DELETE /api/admin/v1/contests/draft                        # 删除草稿
POST   /api/admin/v1/contests/{id}/rank/rebuild            # 重建榜单
POST   /api/admin/v1/contests/{id}/scoreboard/snapshot     # 创建快照
DELETE /api/admin/v1/contests/{id}/scoreboard/snapshot/{type}  # 删除快照
```

## 练习管理

```
GET    /api/admin/v1/practices               # 列表
POST   /api/admin/v1/practices               # 创建
GET    /api/admin/v1/practices/{id}/report   # 统计报告
DELETE /api/admin/v1/practices/{id}          # 删除
```

## 提交管理

```
GET    /api/admin/v1/submissions/{id}/code       # 查看代码
POST   /api/admin/v1/submissions/{id}/rejudge    # 重判（待实现，返回 50100）
```

## 首页管理

```
GET    /api/admin/v1/home                    # 获取配置
PUT    /api/admin/v1/home/daily              # 更新每日一题
GET    /api/admin/v1/home/carousel           # 轮播图列表
POST   /api/admin/v1/home/carousel           # 添加轮播图
PUT    /api/admin/v1/home/carousel/{id}      # 更新轮播图
DELETE /api/admin/v1/home/carousel/{id}      # 删除轮播图
```

## 组织管理

```
GET    /api/admin/v1/organizations/classes   # 班级列表
GET    /api/admin/v1/organizations/clubs     # 社团列表
```

---

# WebSocket API

STOMP over SockJS，端点 `/ws`。连接时需在 CONNECT 帧携带 `Authorization: Bearer <token>`。

### 订阅频道

| 频道 | 说明 | 权限 |
|------|------|------|
| `/topic/submissions/{id}` | 提交状态更新 | 仅本人 |
| `/topic/contests/{id}/scoreboard` | 榜单刷新 | 比赛可见者 |
| `/topic/contests/{id}/announcements` | 比赛公告 | 比赛可见者 |
| `/topic/contests/{id}/status` | 比赛状态变更 | 比赛可见者 |

### 消息格式示例

提交状态更新:
```json
{ "submissionId": 123, "status": "AC", "time": 100, "memory": 2048, "timestamp": 1718000000000 }
```

详见 [WebSocket 重构报告](../WEBSOCKET_REFACTOR_REPORT.md)。

---

**文档版本**: 1.0
**最后更新**: 2026-06-13
