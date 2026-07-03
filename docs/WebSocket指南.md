# WebSocket 使用指南

## 📡 架构概览

QOJ 系统使用 STOMP over WebSocket 实现实时通信，支持以下功能：
- 提交状态实时更新
- 比赛榜单实时刷新
- 比赛公告实时推送
- 比赛状态变更通知

---

## 🔐 安全机制

### 1. 握手鉴权
WebSocket 连接时需要在 header 中携带 JWT Token：

```typescript
connectHeaders: {
  Authorization: `Bearer ${token}`
}
```

后端 `WebSocketAuthInterceptor` 会在 CONNECT 时验证 Token：
- Token 无效 → 拒绝连接
- Token 有效 → 允许连接，并将用户信息存入 session

### 2. 订阅权限控制
后端 `WebSocketSubscriptionInterceptor` 会在 SUBSCRIBE 时验证权限：

| 频道模式 | 权限要求 |
|---------|---------|
| `/topic/contests/{id}/scoreboard` | 用户必须有权限访问该比赛 |
| `/topic/contests/{id}/announcements` | 用户必须有权限访问该比赛 |
| `/topic/submissions/{id}` | 用户只能订阅自己的提交 |

**权限规则**:
- 管理员可以订阅所有频道
- PUBLIC 比赛：任何人都可以订阅
- CLASS 比赛：班级成员可以订阅
- PRIVATE 比赛：参赛者可以订阅

---

## 🚀 前端使用

### 方式 1: 使用 React Hook（推荐）

#### 监听提交状态

```tsx
import { useSubmissionSocket } from "@/hooks/useSubmissionSocket";
import { useState } from "react";

function SubmissionDetail({ submissionId }: { submissionId: number }) {
  const [status, setStatus] = useState("PENDING");
  const [time, setTime] = useState(0);
  const [memory, setMemory] = useState(0);

  useSubmissionSocket({
    submissionId,
    enabled: true,
    onUpdate: (update) => {
      setStatus(update.status);
      setTime(update.time);
      setMemory(update.memory);
      console.log("提交状态更新:", update);
    },
  });

  return (
    <div>
      <p>状态: {status}</p>
      <p>时间: {time}ms</p>
      <p>内存: {memory}KB</p>
    </div>
  );
}
```

#### 监听比赛榜单和公告

```tsx
import { useContestSocket } from "@/hooks/useContestSocket";
import { useState } from "react";

function ContestPage({ contestId }: { contestId: number }) {
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const [announcements, setAnnouncements] = useState<string[]>([]);

  useContestSocket({
    contestId,
    enabled: true,
    
    // 榜单更新
    onScoreboardUpdate: () => {
      console.log("榜单已更新，需要刷新");
      setShouldRefresh(true);
    },
    
    // 新公告
    onAnnouncement: (announcement) => {
      console.log("新公告:", announcement);
      setAnnouncements((prev) => [...prev, announcement.content]);
      alert(`比赛公告: ${announcement.title}`);
    },
    
    // 状态变更
    onStatusChange: (update) => {
      console.log("比赛状态变更:", update.status);
      if (update.status === "ENDED") {
        alert("比赛已结束");
      }
    },
  });

  return (
    <div>
      <h1>比赛 #{contestId}</h1>
      {shouldRefresh && <button onClick={() => window.location.reload()}>刷新榜单</button>}
      <ul>
        {announcements.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 方式 2: 直接使用 WebSocket 客户端

```typescript
import { wsClient } from "@/utils/websocket";

// 连接
await wsClient.connect();

// 订阅提交状态
const unsubscribe = await wsClient.subscribeToSubmission(123, (update) => {
  console.log("提交更新:", update);
});

// 取消订阅
unsubscribe();

// 断开连接
wsClient.disconnect();
```

---

## 🔧 后端推送

### 推送提交状态更新

```java
@Service
public class JudgeService {
    private final JudgeMessagePublisher publisher;

    public void updateSubmissionStatus(Long submissionId, String status, Integer time, Integer memory) {
        // 更新数据库
        // ...
        
        // 推送 WebSocket 消息
        publisher.submissionChanged(submissionId, status, time, memory);
    }
}
```

### 推送榜单更新

```java
@Service
public class ContestService {
    private final JudgeMessagePublisher publisher;

    public void handleNewSubmission(Long contestId, Long submissionId) {
        // 处理提交
        // ...
        
        // 通知榜单刷新
        publisher.contestScoreboardUpdated(contestId);
    }
}
```

### 推送比赛公告

```java
@RestController
@RequestMapping("/api/admin/v1/contests")
public class AdminContestController {
    private final JudgeMessagePublisher publisher;

    @PostMapping("/{id}/announcements")
    public ApiResponse<Void> createAnnouncement(
        @PathVariable Long id,
        @RequestBody AnnouncementRequest request
    ) {
        // 保存公告到数据库
        // ...
        
        // 推送 WebSocket 消息
        publisher.contestAnnouncement(id, request.title(), request.content());
        
        return ApiResponse.ok();
    }
}
```

---

## 📋 频道设计

### 1. 提交状态频道
**频道**: `/topic/submissions/{submissionId}`

**消息格式**:
```json
{
  "submissionId": 123,
  "status": "ACCEPTED",
  "time": 125,
  "memory": 2048,
  "timestamp": 1678901234567
}
```

**权限**: 只有提交者本人可以订阅

---

### 2. 比赛榜单频道
**频道**: `/topic/contests/{contestId}/scoreboard`

**消息格式**:
```json
{
  "contestId": 5,
  "action": "refresh",
  "timestamp": 1678901234567
}
```

**权限**: 有权限访问该比赛的用户可以订阅

**说明**: 后端不推送完整榜单数据，只推送刷新信号。前端收到信号后重新调用 API 获取榜单。

---

### 3. 比赛公告频道
**频道**: `/topic/contests/{contestId}/announcements`

**消息格式**:
```json
{
  "contestId": 5,
  "title": "比赛延长30分钟",
  "content": "由于服务器故障，比赛延长30分钟...",
  "timestamp": 1678901234567
}
```

**权限**: 有权限访问该比赛的用户可以订阅

---

### 4. 比赛状态频道
**频道**: `/topic/contests/{contestId}/status`

**消息格式**:
```json
{
  "contestId": 5,
  "status": "RUNNING",
  "timestamp": 1678901234567
}
```

**权限**: 有权限访问该比赛的用户可以订阅

**状态值**: `NOT_STARTED`, `RUNNING`, `ENDED`

---

## 🧪 测试

### 后端测试
```bash
cd backend
mvn clean compile
mvn spring-boot:run
```

检查日志中是否有 WebSocket 相关信息。

### 前端测试
```bash
npm install
npm run dev
```

打开浏览器控制台，观察 WebSocket 连接日志（开发模式下会打印）。

### 手动测试订阅权限

**测试场景 1**: 订阅自己的提交 ✅
```typescript
wsClient.subscribeToSubmission(mySubmissionId, console.log);
// 应该成功订阅
```

**测试场景 2**: 订阅别人的提交 ❌
```typescript
wsClient.subscribeToSubmission(otherUserSubmissionId, console.log);
// 应该被拒绝（订阅成功但收不到消息，或直接拒绝连接）
```

**测试场景 3**: 订阅公开比赛榜单 ✅
```typescript
wsClient.subscribeToContestScoreboard(publicContestId, console.log);
// 应该成功订阅
```

**测试场景 4**: 订阅私有比赛榜单（无权限）❌
```typescript
wsClient.subscribeToContestScoreboard(privateContestId, console.log);
// 应该被拒绝
```

---

## 🐛 常见问题

### Q1: WebSocket 连接失败
**检查**:
1. 后端是否启动
2. 前端是否有有效的 Access Token
3. Token 是否过期
4. CORS 配置是否正确

### Q2: 订阅后收不到消息
**检查**:
1. 是否有权限订阅该频道
2. 后端是否正确推送消息
3. 频道路径是否正确（注意 `/topic/submissions/123` 不是 `/topic/submission.123`）

### Q3: 开发环境 WebSocket 连接跨域
**解决**: Vite 已配置 WebSocket 代理，使用相对路径即可：
```typescript
const WS_URL = "/ws"; // 开发环境自动代理到 http://127.0.0.1:8080/ws
```

---

## 📦 依赖版本

**后端**:
- Spring Boot 3.3.5
- Spring WebSocket (内置)

**前端**:
- `@stomp/stompjs`: ^7.0.0
- `sockjs-client`: ^1.6.1
- `@types/sockjs-client`: ^1.5.4

---

## 🔄 升级记录

### v1.0 (2026-06-13)
- ✅ 实现 WebSocket 握手鉴权
- ✅ 实现订阅权限控制
- ✅ 实现频道设计（提交、榜单、公告、状态）
- ✅ 实现后端推送服务
- ✅ 实现前端 React Hook 封装

---

**文档维护者**: 开发团队  
**最后更新**: 2026-06-13
