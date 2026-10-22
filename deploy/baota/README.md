# QOJ 宝塔手动部署教程

服务器：`36.137.172.149`，Ubuntu 26.04；宝塔 MySQL 程序已确认在 `/www/server/mysql/bin/mysqld`。以下命令以当前 root SSH 用户执行。

## 部署方式

| 组件 | 运行方式 |
| --- | --- |
| 前端 | 宝塔原生 Nginx，目录 `/www/wwwroot/qoj/frontend` |
| 后端 | 原生 Java 17，systemd 服务 `qoj-backend`，本地 18080 |
| MySQL | 已有宝塔原生 MySQL，本地 3306 |
| Redis | 宝塔原生 Redis，使用面板实际端口和密码 |
| 判题 | Docker go-judge，本地 15050 |

以下逐步准备配置、启动各服务。前端和后端使用之前部署包中的已编译文件，不需要重新构建或安装 Node/Maven。后台聊天随后端运行，独立出题 Agent 不是本次必需组件。

## 1. 确认原生环境

在宝塔软件商店确认 MySQL 为 **8.0 或 8.4**，Nginx 和 Redis 已安装并启动；Java 使用 **17**。如果现有数据库版本较低，先按[宝塔 MySQL 迁移指南](https://docs.bt.cn/practical-tutorials/switch-mysql-version)备份、迁移；不要直接切换承载其他站点的数据库。

在宝塔的 Java/JDK 管理中取得 Java 17 安装目录，操作入口参考[宝塔 Java 部署教程](https://docs.bt.cn/practical-tutorials/java-project-deployment-tutorial)。将下方变量替换为实际 `bin/java` 路径：

```bash
QOJ_JAVA_BIN=/实际JDK17目录/bin/java
"$QOJ_JAVA_BIN" -version
ln -sfn "$QOJ_JAVA_BIN" /usr/local/bin/qoj-java
/usr/local/bin/qoj-java -version
```

两次版本输出应包含 `17`。例如显示 `openjdk version "17.0.x"`。链接供后端服务使用，不依赖宝塔是否把 java 加到全局 PATH。

本教程使用 Python 3 标准库和原生 Java 处理管理员密码，不要求安装 python3-bcrypt，也不使用 apt 安装第二套 MySQL/Nginx。前面 mysql-server 的 dpkg 失败状态仍需另行排查，以下流程不代表已修复系统包管理。

## 2. 在宝塔创建 QOJ 数据库

进入“数据库 → MySQL → 添加数据库”：

- 数据库名 `qoj`，用户名 `qoj`。
- 字符集 `utf8mb4`，访问权限“本地服务器”。
- 设置并保存该专用账号的密码，后面填写到后端配置。

操作入口和权限选项参考[宝塔添加 MySQL 数据库文档](https://docs.bt.cn/user-guide/database/mysql/add)。已有同名库时先确认内容，不要覆盖。

检查原生数据库连接，命令会交互提示密码：

```bash
/www/server/mysql/bin/mysql -h127.0.0.1 -P3306 -uqoj -p qoj -e 'SELECT VERSION();'
```

应返回 8.0.x 或 8.4.x。MySQL 的 `max_allowed_packet` 建议至少 128M，支持较大的聊天附件 SQL 备份恢复；通过宝塔设置、在合适时间重启数据库生效。

Redis 在宝塔中确认端口和密码，本教程示例为 `6379`；需要安装 Redis 时通过宝塔完成，操作入口参考[宝塔软件商店文档](https://docs.bt.cn/user-guide/soft/install)。

### 如果要迁移旧数据

从旧库导出完整应用数据库（包含 `flyway_schema_history`），通过宝塔导入 `qoj`，然后再启动后端。不要导入旧 MySQL 的系统库和账号表。保留旧 QOJ 的 JWT_SECRET，以便读取已有加密设置。

全新数据库无需导入 `migrations/` 中的文件，后端首次启动通过 Flyway 自动执行。

## 3. 准备手动配置文件

将 `qoj-baota-manual-20261006.tar.gz` 和它的 `.sha256` 上传到 `/www/wwwroot/qoj`。该目录已有原部署包的 `frontend`、`backend`、`judge` 等文件。

```bash
cd /www/wwwroot/qoj
sha256sum -c qoj-baota-manual-20261006.tar.gz.sha256
tar -xzf qoj-baota-manual-20261006.tar.gz
ls -l backend/qoj-backend.jar frontend/index.html judge/compose.yml
```

最后一条应显示这三个文件存在。手动配置包仅包含教程、配置模板和管理员密码工具，没有整合部署脚本。

创建后端运行账号；若已经有 qoj 账号，跳过 useradd：

```bash
useradd --system --home-dir /var/lib/qoj --shell /usr/sbin/nologin qoj
mkdir -p /var/lib/qoj /var/log/qoj
chown qoj:qoj /var/lib/qoj /var/log/qoj
chmod 750 /var/lib/qoj /var/log/qoj
chmod 755 /www/wwwroot/qoj /www/wwwroot/qoj/backend
chmod 644 /www/wwwroot/qoj/backend/qoj-backend.jar
```

准备环境文件；如果 `/etc/qoj/backend.env` 已存在，先保留原文件、密钥，直接编辑并核对以下项目，不要覆盖：

```bash
install -d -m 700 /etc/qoj
install -m 600 qoj-baota-manual-20261006/backend.env.example /etc/qoj/backend.env
nano /etc/qoj/backend.env
```

逐项填写：

- `MYSQL_PASSWORD`：宝塔 qoj 数据库账号的密码。
- `REDIS_PORT`、`REDIS_PASSWORD`：实际 Redis 设置；没有密码填 `REDIS_PASSWORD=""`。
- `JWT_SECRET`、`GO_JUDGE_AUTH_TOKEN`、`AGENT_INTERNAL_TOKEN`：分别用下面命令生成三个不同随机值，复制到对应项。
- `CORS_ALLOWED_ORIGINS`：`http://36.137.172.149`，以后换域名/HTTPS时同步修改。

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

迁移旧数据时，`JWT_SECRET` 使用旧值。文件中有密码和密钥，不要发送到聊天中。

后台前缀保持当前前端构建值 `auth_ac`；仅改后端前缀会导致后台请求错误。

## 4. 用 Docker 启动判题

创建判题专用环境文件：

```bash
install -m 600 /dev/null /etc/qoj/judge.env
nano /etc/qoj/judge.env
```

文件只填写下面一行，值必须与 backend.env 中一致：

```text
GO_JUDGE_AUTH_TOKEN=这里填写backend.env中的同一个判题令牌
```

本服务器已有 Docker/Compose：

```bash
cd /www/wwwroot/qoj
docker compose --env-file /etc/qoj/judge.env -f judge/compose.yml up -d --build
docker compose --env-file /etc/qoj/judge.env -f judge/compose.yml ps
curl -fsS http://127.0.0.1:15050/version
```

等待状态显示 healthy；若未就绪，查看：

```bash
docker compose --env-file /etc/qoj/judge.env -f judge/compose.yml logs --tail=100
```

这里只有判题容器，MySQL、Redis、Java 后端使用原生环境。

## 5. 手动注册并启动 Java 后端

先确认账号能读取 JAR：

```bash
runuser -u qoj -- test -r /www/wwwroot/qoj/backend/qoj-backend.jar
```

返回码 0 且没有输出表示正常；否则检查父目录的遍历权限。

复制 systemd 配置，然后启动：

```bash
cp /www/wwwroot/qoj/qoj-baota-manual-20261006/qoj-backend.service /etc/systemd/system/qoj-backend.service
systemctl daemon-reload
systemctl enable --now qoj-backend
systemctl status qoj-backend --no-pager
journalctl -u qoj-backend -n 100 --no-pager
```

服务文件已指向 `/usr/local/bin/qoj-java` 和当前 JAR，读取 `/etc/qoj/backend.env`。后端自行连接宝塔 MySQL/Redis，不依赖系统的 mysql.service 或 qoj-redis.service。

检查本地接口：

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/api/v1/courses
```

正常返回 401（未登录）。首次迁移可能需要等待，出现失败先查看后端日志。

### 全新数据库设置管理员密码

在配置公网站点之前执行：

```bash
python3 /www/wwwroot/qoj/qoj-baota-manual-20261006/set-admin-password.py
```

按提示设置 `admin` 密码，至少 12 字符、最多 72 字节。工具只更新该超级管理员密码，不部署或重启服务；哈希由包内 Spring Security BCrypt 在原生 Java 17 中生成。

迁移已有数据库时保留原管理员密码，跳过这一步。

## 6. 手动配置宝塔 Nginx

在宝塔新建 HTML/静态站点：

- 域名/IP：`36.137.172.149`。
- 网站根目录：`/www/wwwroot/qoj/frontend`。
- 不创建数据库或 PHP 环境。

若该 IP/域名已有站点，先确认是否属于 QOJ，避免覆盖其他站点。

打开 QOJ 站点的“配置文件”，使用手动包内 `nginx-site.conf` 内容。可以先查看：

```bash
cat /www/wwwroot/qoj/qoj-baota-manual-20261006/nginx-site.conf
```

模板是完整 `server { ... }`，替换新建 QOJ 站点的完整配置，不能嵌套到已有 server 块内，也不要放到全局 nginx.conf。面板入口参考[宝塔站点配置文档](https://docs.bt.cn/user-guide/site/php/site-config/config-file/)。

检查并重载宝塔 Nginx：

```bash
/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
```

前台：`http://36.137.172.149/`；后台：`http://36.137.172.149/auth_ac`。云安全组和宝塔防火墙开放 80/443。

该配置包含 SPA 路由、API 反代、聊天 SSE、WebSocket 和真实 IP 转发。比赛网段限制通过后端识别请求 IP；如经过额外代理/CDN，需要为 Nginx 配置受信任代理的 real_ip。

## 7. 后续维护

修改 backend.env 后执行 `systemctl restart qoj-backend`。后台日志使用 `journalctl -u qoj-backend -f`；数据库、Redis、Nginx 继续由宝塔管理。HTTPS 在宝塔站点 SSL 设置中启用，保留 API/SSE/WebSocket 块，并修改 CORS_ALLOWED_ORIGINS 为 HTTPS 来源后重启后端。

升级前通过宝塔备份整个 qoj 应用库，另行保留 `/etc/qoj/` 的密钥。停后端、替换 frontend/JAR、启动后端执行迁移；不要运行原包的自动安装/升级脚本，它们对应另一套系统服务。

完成后手动登录，查看课程、比赛、题目，提交一次 A+B，确认实际判题可用。文件构建与配置语法已检查；尚未在你的服务器进行安装或提交验收。
