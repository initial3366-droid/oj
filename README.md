# QOJ 校园在线评测系统

QOJ (Quan Online Judge) 是一个面向大学生的校园在线评测平台，支持题库、练习集、比赛（ACM/OI 双赛制）、排行榜等功能。

## 快速开始

### 一键 Docker 部署（推荐）

在 Linux / macOS / Windows（WSL 或 Git Bash）上，只要有 Docker（含 Compose v2），一条命令即可拉起完整技术栈（前端 nginx + 后端 + MySQL + Redis + go-judge 判题沙箱）：

```bash
./deploy.sh
```

首次运行会自动生成含随机密钥的 `.env.production`（端口、密码、判题并发等均可在该文件中调整后重新执行），随后构建镜像并启动；数据保存在 Docker 命名卷中，升级只需重新执行 `./deploy.sh`。数据库与判题沙箱只在内网互通，仅前端端口对外发布。更多命令（`logs` / `ps` / `down`）见 [部署文档.md](docs/部署文档.md)。

> 部署机不想放源码？项目发布版本后可直接拉取预构建镜像部署（支持国内直连加速），见[一站式部署教程 · 方式 C](docs/一站式部署教程.md)。

> go-judge 判题沙箱需要特权容器，请部署在可信主机；默认占用约 4-6 GB 内存，可在 `.env.production` 中按机器规格下调。

### 本地开发

**前置要求**
- Node.js `>=20 <25` / npm 9+
- Java 17+
- Maven 3.8+
- Docker & Docker Compose

### 本地启动

**1. 安装前端依赖**

```bash
npm install
```

**2. 启动数据库**
```bash
docker compose -f .runtime/qoj-deps.compose.yml up -d
```

**3. 启动后端**（默认端口 `18080`）
```bash
cd backend
mvn spring-boot:run
```

**4. 在另一个终端启动前端**（默认端口 `5173`）
```bash
npm run dev
```

**5. 访问系统**
- 用户端: http://127.0.0.1:5173
- 管理后台: http://127.0.0.1:5173/admin
- API 文档: http://127.0.0.1:18080/swagger-ui.html

开发服务器会将 `/api` 和 `/ws` 请求代理到后端；后端地址不同，可通过 `VITE_API_PROXY_TARGET` 覆盖。

## 核心功能

- **题库系统**: 题目管理、分类、难度标签、样例数据
- **练习集**: 教师可创建面向班级/社团的练习
- **比赛系统**: ACM/OI 双赛制，含封榜
- **判题系统**: 普通题/练习使用 go-judge，比赛使用 CCPCOJ 拉取式评测
- **排行榜**: 全局/班级 Rating 排名
- **实时比赛**: 倒计时精确到秒，比赛结束通过 WebSocket 向比赛页、首页和写题页面推送通知
- **评测数据**: 显示运行时间、内存占用以及题目的时间/内存限制
- **班级管理**: 支持 CSV/XLS/XLSX 批量导入学生

## 技术栈

### 前端
- React 19 + TypeScript 5
- Vite 5
- Ant Design 6（公共页面）
- Arco Design（管理后台和教师端）
- Monaco Editor
- KaTeX

### 后端
- Spring Boot 4.1.1 (Java 17)
- Spring Security + JWT
- MyBatis-Plus
- MySQL 8.0 + Redis 7
- Flyway
- WebSocket (STOMP)
- Spring AI 2.0.1（模型接入与结构化输出）
- 独立 Java Agent 容器（AI 出题、SSE 进度与隔离验题）

## 构建与校验

构建前端静态文件：

```bash
npm run build
```

产物位于 `dist/`。构建会将生成的 CSS/JS 资源写入入口 `index.html`，并压缩入口 HTML 的无意义空白，适合交给 Nginx 或 CDN 托管。

构建后端 JAR：

```bash
cd backend
mvn -q package -DskipTests
```

产物为 `backend/target/qoj-backend-0.1.0.jar`。运行后端测试：

```bash
cd backend
mvn test
```

## 文档

完整文档位于 `docs/` 目录：

| 文档 | 说明 |
|------|------|
| [一站式部署教程.md](docs/一站式部署教程.md) | **新手首选**：从装 Docker 到登录后台的完整部署教程 |
| [项目说明.md](docs/项目说明.md) | 完整的项目介绍、技术栈、环境变量、常见问题 |
| [接口文档.md](docs/接口文档.md) | REST API、WebSocket 接口、认证机制 |
| [数据库文档.md](docs/数据库文档.md) | 表结构、迁移历史、索引优化 |
| [安全文档.md](docs/安全文档.md) | 代码隔离、JWT、权限模型、数据保护 |
| [部署文档.md](docs/部署文档.md) | 生产环境部署、Nginx 配置、监控日志 |
| [验证报告.md](docs/验证报告.md) | 系统验证报告（构建、测试、安全检查）|

### 专题文档

- [权限系统设计.md](docs/权限系统设计.md) - 三层权限模型设计
- [审计日志指南.md](docs/审计日志指南.md) - 管理员操作审计
- [WebSocket指南.md](docs/WebSocket指南.md) - 实时推送实现
- [前端认证安全指南.md](docs/前端认证安全指南.md) - 前端安全最佳实践
- [比赛排名系统说明.md](docs/比赛排名系统说明.md) - 比赛排名规则与实现说明
- [go-judge 安全部署说明](docs/go-judge-security-deployment.md) - 判题服务隔离与部署边界

后端补充文档位于 `backend/docs/`，QOJ 题目推送工具位于 `tools/qoj-publish/`。

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

# 前端开发代理和管理后台路径
VITE_API_PROXY_TARGET=http://127.0.0.1:18080
VITE_ADMIN_PREFIX=admin

```

## 安全警告

⚠️ **生产环境禁止使用默认配置**：

1. 必须修改 `JWT_SECRET` 为 64 字节以上的随机字符串
2. go-judge 仅绑定内网/回环地址并配置 32 位以上随机令牌
3. 使用强密码保护 MySQL 和 Redis
4. 启用 HTTPS，并配置反向代理的 WebSocket 转发
5. 不要将代理服务地址、测试账号密码或任何 `.env` 文件提交到 Git

判题迁移和生产部署边界见 [go-judge 安全部署说明](docs/go-judge-security-deployment.md)。

详见 [安全文档.md](docs/安全文档.md)。

## 常用验证命令

提交改动前建议执行：

```bash
npm run build
cd backend && mvn test
python3 -m py_compile tools/qoj-publish/qoj_publish.py tools/qoj-publish/qoj_web.py
```

构建、测试和生产部署边界见 [部署文档.md](docs/部署文档.md) 与 [验证报告.md](docs/验证报告.md)。

## 开源协议

MIT License

## 联系方式

- 问题反馈: 提交 GitHub Issue
- 开发团队: 人生若只入初见
