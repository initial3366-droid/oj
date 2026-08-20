# QOJ - 校园在线评测系统

QOJ (Question Online Judge) 是一个面向校园的现代化在线评测系统，支持算法竞赛训练、课程作业提交、班级练习管理等场景。

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.5-6DB33F?logo=spring)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-17-007396?logo=openjdk)](https://openjdk.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)

---

## 📋 项目介绍

QOJ 提供完整的在线评测功能，包括：

- **题库管理**: 支持 Markdown + LaTeX 题面，样例测试，自定义测试数据
- **比赛系统**: ACM 和 OI 两种赛制，封榜/滚榜，实时排名
- **练习模式**: 按知识点组织题目，跟踪学习进度
- **组织管理**: 班级和社团管理，权限分级控制
- **判题服务**: go-judge 普通评测 + CCPCOJ 比赛评测，支持 C/C++/Java/Python
- **实时通信**: WebSocket 推送判题结果、比赛公告、榜单更新

**核心特性**:
- ✅ 三层权限检查（登录 → 角色 → 资源所有权）
- ✅ JWT Token 自动轮换机制
- ✅ WebSocket 实时推送
- ✅ 私有题目和比赛数据隔离
- ✅ 用户代码仅在独立 go-judge/CCPCOJ 沙箱节点执行

---

## 🛠️ 技术栈

### 前端
- **框架**: React 19 + TypeScript 5
- **构建工具**: Vite 6
- **UI 组件**: NextUI (HeroUI 适配)
- **路由**: React Router v6
- **代码编辑器**: Monaco Editor
- **数学渲染**: KaTeX
- **WebSocket**: STOMP over SockJS

### 后端
- **框架**: Spring Boot 3.3.5 + Java 17
- **安全认证**: Spring Security + JWT (HS512)
- **ORM**: MyBatis-Plus
- **数据库迁移**: Flyway
- **缓存**: Redis 7
- **WebSocket**: Spring WebSocket + STOMP
- **判题集成**: go-judge REST API / CCPCOJ 拉取网关

### 数据库与中间件
- **数据库**: MySQL 8.0
- **缓存**: Redis 7
- **判题服务**: go-judge（普通题/练习）/ CCPCOJ（比赛）

---

## 🚀 快速开始

### 前置要求

- Node.js >= 18
- JDK 17
- Maven 3.8+
- MySQL 8.0
- Redis 7
- Docker 和 Docker Compose

---

## 📦 本地启动

### 1. 克隆项目

```bash
git clone <repository-url>
cd qoj
```

### 2. 启动数据库和 Redis

```bash
docker compose -f .runtime/qoj-deps.compose.yml up -d
```

服务端口:
- MySQL: `localhost:13306`
- Redis: `localhost:16379`

### 3. 配置环境变量

复制环境变量模板:

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库和 JWT 密钥:

```bash
# 数据库配置
MYSQL_HOST=localhost
MYSQL_PORT=13306
MYSQL_DATABASE=qoj
MYSQL_USERNAME=root
MYSQL_PASSWORD=root

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=16379
REDIS_PASSWORD=

# JWT 密钥（生产环境必须至少 64 字节）
JWT_SECRET=your-very-long-secret-key-at-least-64-bytes-for-production-use

# go-judge 服务（地址和令牌不写入数据库）
GO_JUDGE_BASE_URL=http://127.0.0.1:15050
GO_JUDGE_AUTH_TOKEN=replace-with-openssl-rand-hex-32
```

> ⚠️ **安全警告**: 生产环境的 `JWT_SECRET` 必须至少 64 字节且随机生成，否则系统将拒绝启动。

---

## 🎨 前端启动

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问: `http://localhost:5173`

Vite 开发服务器会自动代理以下请求到后端:
- `/api/**` → `http://127.0.0.1:8080`
- `/ws` → `http://127.0.0.1:8080/ws`

### 构建生产版本

```bash
npm run build
npm run preview  # 预览构建结果
```

---

## ⚙️ 后端启动

### 方式1：使用启动脚本（推荐）

```bash
cd backend
./start.sh
```

启动脚本会自动：
- 加载项目根目录的 `.env` 文件
- 设置正确的环境变量
- 启动 Spring Boot 应用

### 方式2：手动启动

**重要**：必须先加载环境变量，否则会连接错误的数据库端口。

```bash
# 方法1：使用 export
export $(grep -v '^#' ../.env | xargs)
cd backend
mvn spring-boot:run

# 方法2：在同一行设置环境变量
MYSQL_HOST=localhost MYSQL_PORT=13306 REDIS_PORT=16379 mvn spring-boot:run
```

### 安装依赖

```bash
cd backend
mvn clean install -DskipTests
```

### 数据库初始化

Flyway 会在应用启动时自动执行数据库迁移:

```bash
mvn spring-boot:run
```

数据库迁移脚本位于: `backend/src/main/resources/db/migration/`

**手动执行迁移** (可选):

```bash
mvn flyway:migrate
```

### 启动后端服务

```bash
mvn spring-boot:run
```

或使用 IDE (IDEA/Eclipse) 运行 `QojApplication.java`

访问: `http://localhost:8080`

### 运行测试

```bash
mvn test
```

---

## 🗄️ 数据库初始化

### 自动迁移 (推荐)

首次启动后端时，Flyway 会自动执行所有迁移脚本:

1. 创建表结构 (14 个迁移脚本)
2. 初始化基础数据
3. 创建索引

### 查看迁移状态

```bash
mvn flyway:info
```

### 回滚迁移 (开发环境)

```bash
mvn flyway:clean   # ⚠️ 警告：删除所有表
mvn flyway:migrate # 重新执行迁移
```

### 数据库结构

核心表:
- `users` / `admin_users` - 用户账号
- `problems` - 题目库
- `test_cases` - 测试用例
- `submissions` - 提交记录
- `contests` - 比赛
- `contest_problems` - 比赛题目
- `practices` - 练习
- `classes` / `clubs` - 组织管理
- `leaderboard_*` - 排行榜缓存

详见: [docs/database.md](docs/database.md)

---

## 🔴 Redis 启动

### 使用 Docker Compose (推荐)

```bash
docker compose -f .runtime/qoj-deps.compose.yml up -d redis
```

### 手动启动

```bash
redis-server --port 16379
```

### Redis 用途

- **Token 黑名单**: 存储已撤销的 JWT Token
- **Token 族群追踪**: 检测 Refresh Token 重放攻击
- **题目缓存**: 缓存热门题目信息
- **榜单缓存**: 缓存比赛排名数据
- **判题队列**: 存储待判题提交 (可选)

---

## 🌐 环境变量说明

### 必填变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `MYSQL_HOST` | MySQL 主机地址 | `127.0.0.1` |
| `MYSQL_PORT` | MySQL 端口 | `13306` |
| `MYSQL_DATABASE` | 数据库名 | `qoj` |
| `MYSQL_USERNAME` | 数据库用户名 | `root` |
| `MYSQL_PASSWORD` | 数据库密码 | `root` |
| `REDIS_HOST` | Redis 主机地址 | `127.0.0.1` |
| `REDIS_PORT` | Redis 端口 | `16379` |
| `JWT_SECRET` | JWT 签名密钥 | (至少 64 字节) |

### 可选变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `REDIS_PASSWORD` | Redis 密码 | (空) |
| `GO_JUDGE_BASE_URL` | 后端可访问的 go-judge 私网地址 | `http://127.0.0.1:15050` |
| `GO_JUDGE_AUTH_TOKEN` | go-judge Bearer Token（生产至少 32 位） | - |

### JWT_SECRET 生成

**生产环境必须使用至少 64 字节的随机密钥**:

```bash
# Linux/macOS
openssl rand -base64 64

# 或使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

---

## ⚖️ 判题模块说明

### 判题方式

QOJ 固定两条互斥链路，后台不能修改执行端地址或切换到宿主机执行：

1. 普通题、练习和自定义输入由 `JudgeQueueScheduler` 发送到 go-judge。
2. 比赛提交由 CCPCOJ worker 通过 `/ojtool/judge` 领取并回传结果。

go-judge 的可执行文件、参数、环境变量、源码文件名和资源限制均由后端白名单生成；用户输入只作为源码内容或标准输入。部署文件见 `docker/go-judge/`，CCPCOJ worker 见 `docker/ccpcoj/`。

生产环境必须将评测器放在独立 Linux 主机或 VM，仅允许后端私网访问，禁止把 go-judge 端口暴露到公网。完整配置和威胁边界见 [go-judge 安全部署说明](../docs/go-judge-security-deployment.md)。

---

## 🔒 安全特性

### 1. 三层权限检查

```
用户请求
  ↓
[Layer 1] SecurityConfig - URL 级别拦截
  ↓
[Layer 2] @PreAuthorize - Controller 角色检查
  ↓
[Layer 3] AdminApiInterceptor - 资源所有权检查
  ↓
业务逻辑
```

### 2. JWT Token 轮换

- Access Token: 15 分钟
- Refresh Token: 7 天
- 自动检测 Token 重放攻击
- Token 黑名单机制

### 3. 代码沙箱隔离

- go-judge 使用 cgroup、namespace、进程数和输出限制隔离用户代码
- 限制 CPU、内存、网络访问
- 禁止系统调用

详见: [docs/security.md](docs/security.md)

---

## 📚 文档

- [API 接口文档](docs/api.md)
- [数据库设计](docs/database.md)
- [安全说明](docs/security.md)
- [部署指南](docs/deploy.md)
- [认证安全报告](BACKEND_AUTH_SECURITY_REFACTOR_REPORT.md)
- [WebSocket 重构报告](WEBSOCKET_REFACTOR_REPORT.md)
- [管理端接口统一报告](ADMIN_API_UNIFICATION_REPORT.md)
- [无用代码审计报告](UNUSED_CODE_AUDIT_REPORT.md)

---

## ❓ 常见问题

### 1. 数据库连接失败

**问题**: `Connection refused` 或 `Access denied`

**解决**:
```bash
# 检查 MySQL 容器是否运行
docker ps | grep mysql

# 重启 MySQL 容器
docker compose -f .runtime/qoj-deps.compose.yml restart mysql
```

### 2. JWT_SECRET 过短导致启动失败

**问题**: `IllegalStateException: 【生产环境启动失败】JWT_SECRET 长度不足`

**解决**:
```bash
# 生成至少 64 字节的密钥
openssl rand -base64 64
```

### 3. 前端代理不生效

**问题**: 前端无法访问后端 API

**解决**:
```bash
# 检查后端是否运行
curl http://localhost:8080/api/v1/home
```

### 4. Flyway 迁移失败

**问题**: `Migration checksum mismatch`

**解决**:
```bash
# 开发环境可以清空重建
mvn flyway:clean
mvn flyway:migrate
```

### 4. 判题一直 PENDING

**问题**: 提交后状态一直是 PENDING

**解决**:
```bash
# 检查 go-judge 私网健康状态和后端配置
docker compose --env-file docker/go-judge/.env -f docker/go-judge/docker-compose.yml ps

# 查看后端日志中的判题错误信息
```

### 5. 后端登录"没有任何提示"

**问题**: 管理员登录时没有任何反馈

**原因**: 后端没有正确加载环境变量，导致：
- MySQL 连接到错误的端口（6379而不是13306）
- Redis 连接失败

**解决**:
```bash
# 使用启动脚本（推荐）
cd backend
./start.sh

# 或手动加载环境变量
export $(grep -v '^#' ../.env | xargs)
mvn spring-boot:run
```

**默认管理员账号**:
- 用户名: `admin`
- 密码: `admin123`
- 登录地址: http://localhost:5173/admin/login

### 6. WebSocket 连接失败

**问题**: 实时推送不工作

**解决**: 打开浏览器控制台查看 WebSocket 连接错误

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

[MIT License](LICENSE)

---

## 🔗 相关链接

- [Spring Boot 文档](https://spring.io/projects/spring-boot)
- [React 文档](https://react.dev/)
- [go-judge](https://github.com/criyle/go-judge)
- [MyBatis-Plus 文档](https://baomidou.com/)
