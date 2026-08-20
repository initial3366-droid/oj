# QOJ 校园在线评测系统

QOJ (Quan Online Judge) 是一个面向大学生的校园在线评测平台，支持题库、练习集、比赛（ACM/OI 双赛制）、排行榜等功能。

## 快速开始

### 前置要求
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
- **并发压测**: 提供最多 100 人登录、报名和同时提交的压测工具

## 技术栈

### 前端
- React 19 + TypeScript 5
- Vite 5
- Ant Design 6（公共页面）
- Arco Design（管理后台和教师端）
- Monaco Editor
- KaTeX

### 后端
- Spring Boot 3.3.5 (Java 17)
- Spring Security + JWT
- MyBatis-Plus
- MySQL 8.0 + Redis 7
- Flyway
- WebSocket (STOMP)

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

## 100 人比赛压测

压测工具位于 [`tools/contest-loadtest/`](tools/contest-loadtest/)，默认最多模拟 100 个普通学生登录、报名并同时提交。工具默认是 dry-run，只有同时传入 `--execute --confirm-online` 才会访问线上站点。

后台批量导入文件：[qoj-student-import-100.csv](tools/contest-loadtest/qoj-student-import-100.csv)。操作路径：

`管理后台 → 班级管理 → 导入学生`

文件字段为 `学号,姓名`。导入后用户名自动使用学号，初始密码为学号末 6 位。导入后的用户名和密码再填写到本地 `tools/contest-loadtest/accounts.csv`；该文件被 Git 忽略，不应提交。

安装依赖并复制配置模板：

```bash
python3 -m pip install -r tools/contest-loadtest/requirements.txt
cp tools/contest-loadtest/.env.example tools/contest-loadtest/loadtest.env
```

编辑本地 `loadtest.env`，填写网站地址、比赛 ID、比赛题目 ID、账号文件和源码文件。代理地址（包括密钥）只放在本地环境变量或本地 env 文件中：

```bash
export QOJ_PROXY_API_URL='https://your-proxy-provider.example/api/proxy?...'
```

已提前报名的账号：

```bash
python3 tools/contest-loadtest/contest_load_test.py \
  --env-file tools/contest-loadtest/loadtest.env \
  --users 100 --no-register \
  --execute --confirm-online
```

需要脚本自动报名时使用 `--register`；需要等待判题结果时追加 `--wait-for-results`。JSON/HTML 报告默认生成在 `tools/contest-loadtest/reports/`。完整说明见 [`tools/contest-loadtest/README.md`](tools/contest-loadtest/README.md) 和 [`STRESS_TEST_README.md`](STRESS_TEST_README.md)。

仅对自己拥有或明确获授权的站点进行线上压测，并提前确认 CDN、WAF、代理商和云厂商的流量政策。

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

# 压测代理地址只放在本地，不要提交
QOJ_PROXY_API_URL=https://your-proxy-provider.example/api/proxy?secret=REPLACE_ME
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
python3 -m py_compile \
  stress_test.py stress_test_with_config.py \
  tools/contest-loadtest/contest_load_test.py
```

构建、测试和生产部署边界见 [部署文档.md](docs/部署文档.md) 与 [验证报告.md](docs/验证报告.md)。

## 开源协议

MIT License

## 联系方式

- 问题反馈: 提交 GitHub Issue
- 开发团队: 人生若只入初见
