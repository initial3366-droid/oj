# QOJ 校园在线评测系统

QOJ (Qingling Online Judge) 是一个面向中学生的校园在线评测平台，支持题库、练习集、比赛（ACM/OI 双赛制）、排行榜等功能。

## 快速开始

### 前置要求
- Node.js 20-24 / npm 9+
- Java 17+
- Maven 3.8+
- Docker & Docker Compose

### 启动步骤

**1. 启动数据库**
```bash
docker compose -f .runtime/qoj-deps.compose.yml up -d
```

**2. 启动后端**
```bash
cd backend
mvn spring-boot:run
```

**3. 启动前端**
```bash
npm install
npm run dev
```

**4. 访问系统**
- 用户端: http://127.0.0.1:5173
- 管理后台: http://127.0.0.1:5173/admin
- API 文档: http://127.0.0.1:18080/swagger-ui.html

## 核心功能

- **题库系统**: 题目管理、分类、难度标签、样例数据
- **练习集**: 教师可创建面向班级/社团的练习
- **比赛系统**: ACM/OI 双赛制，含封榜、防切屏
- **判题系统**: 普通题/练习使用 go-judge，比赛使用 CCPCOJ 拉取式评测
- **排行榜**: 全局/班级/社团三级 Rating 排名
- **实时更新**: WebSocket 推送提交状态、比赛榜单

## 技术栈

### 前端
- React 19 + TypeScript 5
- Vite 6
- NextUI (HeroUI)
- Monaco Editor
- KaTeX

### 后端
- Spring Boot 3.3.5 (Java 17)
- Spring Security + JWT
- MyBatis-Plus
- MySQL 8.0 + Redis 7
- Flyway
- WebSocket (STOMP)

## 文档

完整文档位于 `docs/` 目录：

| 文档 | 说明 |
|------|------|
| [项目说明.md](docs/项目说明.md) | 完整的项目介绍、技术栈、环境变量、常见问题 |
| [接口文档.md](docs/接口文档.md) | REST API、WebSocket 接口、认证机制 |
| [数据库文档.md](docs/数据库文档.md) | 表结构、迁移历史、索引优化 |
| [安全文档.md](docs/安全文档.md) | 代码隔离、JWT、权限模型、数据保护 |
| [部署文档.md](docs/部署文档.md) | 生产环境部署、Nginx 配置、监控日志 |
| [验证报告.md](docs/验证报告.md) | 系统验证报告（构建、测试、安全检查）|

### 开发相关文档

- [权限系统设计.md](docs/权限系统设计.md) - 三层权限模型设计
- [审计日志指南.md](docs/审计日志指南.md) - 管理员操作审计
- [WebSocket指南.md](docs/WebSocket指南.md) - 实时推送实现
- [前端认证安全指南.md](docs/前端认证安全指南.md) - 前端安全最佳实践

### 重构报告

- [比赛模块重构报告.md](docs/比赛模块重构报告.md)
- [练习模块重构报告.md](docs/练习模块重构报告.md)
- [判题系统安全重构报告.md](docs/判题系统安全重构报告.md)
- [后端认证安全重构报告.md](docs/后端认证安全重构报告.md)

完整文档列表请查看 `docs/` 目录。

## 环境变量

创建 `.env` 文件配置敏感信息：

```bash
# MySQL
MYSQL_HOST=127.0.0.1
MYSQL_PORT=13306
MYSQL_DATABASE=qoj
MYSQL_USERNAME=root
MYSQL_PASSWORD=root

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=16379
REDIS_PASSWORD=

# JWT（生产环境必须修改！）
JWT_SECRET=change-this-to-a-random-64-byte-string
JWT_ACCESS_EXPIRE=900
JWT_REFRESH_EXPIRE=604800

# go-judge 地址与令牌只从部署环境读取，浏览器和数据库均不保存。
GO_JUDGE_BASE_URL=http://127.0.0.1:15050
GO_JUDGE_AUTH_TOKEN=replace-with-openssl-rand-hex-32

# CCPCOJ 账号、密码和任务超时在管理后台“判题配置”中维护。
```

## 安全警告

⚠️ **生产环境禁止使用默认配置**：

1. 必须修改 `JWT_SECRET` 为 64 字节以上的随机字符串
2. go-judge 仅绑定内网/回环地址并配置 32 位以上随机令牌
3. 使用强密码保护 MySQL 和 Redis
4. 启用 HTTPS（通过 Nginx + Let's Encrypt）

判题迁移和生产部署边界见 [go-judge 安全部署说明](docs/go-judge-security-deployment.md)。

详见 [安全文档.md](docs/安全文档.md)。

## 验证状态

✅ **所有验证通过（34/34）**

- ✅ 前端构建成功（838ms）
- ✅ 后端所有测试通过（140/140 tests）
- ✅ 数据库迁移验证（22个迁移脚本）
- ✅ 接口权限验证（12项全通过）
- ✅ 安全配置验证（7项全通过）

详见 [验证报告.md](docs/验证报告.md)。

## 开源协议

MIT License

## 联系方式

- 问题反馈: 提交 GitHub Issue
- 开发团队: QOJ Team
