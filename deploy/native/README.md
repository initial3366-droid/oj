# QOJ 新服务器部署教程（MySQL、Redis 不使用 Docker）

此包包含已经编译的前端、Spring Boot 后端 JAR、可选独立 Agent JAR、Nginx/systemd 配置和安装脚本。服务器不需要 Node、Maven 或项目源码。

## 1. 部署方案

自动安装脚本面向 **Ubuntu 26.04 LTS / 24.04 LTS / 22.04 LTS，amd64 或 arm64**。JAR 和静态前端可以跨这两种架构运行，判题镜像在目标服务器按其架构构建。建议 4 核、8 GB 内存，磁盘至少预留 30 GB；这是根据本包给后端和判题服务设置的资源上限给出的起步配置。

Ubuntu 22.04/24.04 使用发行版提供的 MySQL 8.0；[Ubuntu 26.04 提供 MySQL 8.4](https://packages.ubuntu.com/resolute/mysql-server)。脚本会启用 universe 软件源，以安装 26.04 中的 [Java 17](https://packages.ubuntu.com/resolute/openjdk-17-jre-headless) 和 [Redis](https://packages.ubuntu.com/resolute/redis-server)，无需更换系统或安装 Docker 数据库。迁移只导出应用数据库 `qoj`，不要导出旧 MySQL 的系统库和账号表。

| 组件 | 运行方式 | 地址 / 数据位置 |
| --- | --- | --- |
| 前端 | 系统 Nginx | 对外 80/443；`/opt/qoj/current/frontend` |
| 后端 | Java 17 + systemd | `127.0.0.1:18080`；日志 `/var/log/qoj` |
| MySQL | Ubuntu 原生安装 | `127.0.0.1:3306`；通常 `/var/lib/mysql` |
| Redis | 原生 Redis 独立实例 | `127.0.0.1:16379`；`/var/lib/qoj-redis` |
| go-judge | 单独 Docker 判题沙箱 | `127.0.0.1:15050`；支持 C/C++/Java/Python |
| 独立出题 Agent | 可选隔离容器 | `127.0.0.1:19090`；通过 `/agent/` 反代 |

**数据库没有 Docker 服务，也不使用 Docker 数据卷。** Docker 仅用于判题沙箱，以及可选的独立出题 Agent。MySQL 原生安装命令参考 [Ubuntu 官方文档](https://ubuntu.com/server/docs/install-and-configure-a-mysql-server)；Docker 安装脚本按 [Docker 官方 Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/)配置软件源。MySQL 专用配置在 `/etc/mysql/mysql.conf.d/qoj.cnf`，绑定回环地址，设置 utf8mb4、东八区及 128 MB 数据包上限，以支持较大聊天附件的 SQL 备份恢复。

后台路径以包内 `build-info.json` 的 `adminPrefix` 为准。本次打包保留当前项目的 `/auth_ac` 和 `/api/auth_ac/v1`，前后端必须使用相同前缀。已经打包后只改后端前缀会使管理后台请求失败。

## 2. 上传和解压

把 `.tar.gz` 和配套 `.tar.gz.sha256` 一起上传到服务器。以下 `qoj-native-YYYYMMDD-HHMMSS` 换成实际包名，`SERVER_IP` 换成服务器 IP。SSH 用户可以是 `root`，也可以是拥有 sudo 权限的用户。

本机执行：

```bash
scp qoj-native-YYYYMMDD-HHMMSS.tar.gz qoj-native-YYYYMMDD-HHMMSS.tar.gz.sha256 ubuntu@SERVER_IP:~/
ssh ubuntu@SERVER_IP
```

服务器执行：

```bash
sha256sum -c qoj-native-YYYYMMDD-HHMMSS.tar.gz.sha256
tar -xzf qoj-native-YYYYMMDD-HHMMSS.tar.gz
cd qoj-native-YYYYMMDD-HHMMSS
```

`sha256sum` 应显示 `OK`。包内另有 `SHA256SUMS`，安装脚本会再次检查解压文件。

校验失败时先运行 `sha256sum --quiet -c SHA256SUMS` 查看不一致的文件，再从已校验的原始包恢复文件。修改安装脚本或只替换部分补丁文件都会导致校验失败。重新解压到新目录可以保留现有目录供排查，不要重新生成清单来掩盖文件差异。

## 3A. 全新安装

如果不需要旧服务器数据，直接执行以下步骤。`SITE_URL` 用服务器 IP，或已经解析到该服务器的域名。使用域名时可以填写最终的 HTTPS 地址，随后按第 6 节配置证书。

地址必须包含协议，例如 `http://36.137.172.149`。先等待 `install.sh` 显示“准备完成”，再执行后续命令；它会生成 `/opt/qoj/current` 和 `/etc/qoj/judge.env`。`judge.env` 不在解压目录中，安装中途失败时也尚未生成。

```bash
SITE_URL=http://SERVER_IP
sudo bash scripts/install.sh "$SITE_URL"

sudo bash /opt/qoj/current/scripts/install-docker.sh
sudo docker compose --env-file /etc/qoj/judge.env \
  -f /opt/qoj/current/judge/compose.yml up -d --build

sudo bash /opt/qoj/current/scripts/start.sh --fresh
```

最后一条命令会启动后端、执行全部 Flyway 数据库迁移，并在启用 QOJ Nginx 入口前提示设置 `admin` 的新密码。密码至少 12 字符、最多 72 字节，输入不回显。默认种子密码不会作为本教程的生产登录密码使用。

完成后访问：

- 前台：`http://SERVER_IP/`
- 后台：`http://SERVER_IP/auth_ac`
- 后台账号：`admin`，密码为你刚设置的密码。

不要手动逐个导入 `migrations/` 中的 SQL；JAR 包已包含这些迁移，首次启动自动执行。

## 3B. 迁移旧服务器的数据

如果需要保留用户、题库、测试点、比赛、提交记录、课程及系统设置，选择本节，不要先执行 `start.sh --fresh`。

### 在旧服务器备份

最终切换时先停止旧站点写入和后台判题，避免备份后产生的新提交留在旧服务器。保留旧服务的 `JWT_SECRET`；项目的部分加密配置使用它派生密钥，迁移时直接更换可能导致旧加密配置无法读取。

如果旧服务的 MySQL 已经是原生安装，使用原账号通过 `mysql_config_editor` 交互保存本机登录信息，再导出完整数据库（不要排除 `flyway_schema_history`）：

```bash
mysql_config_editor set --login-path=qoj-migration --host=127.0.0.1 --port=3306 --user=qoj --password
umask 077
mysqldump --login-path=qoj-migration --single-transaction --quick \
  --no-tablespaces --set-gtid-purged=OFF --hex-blob \
  --default-character-set=utf8mb4 qoj > qoj-transfer.sql
```

如果旧数据库就是当前开发环境的 `qoj-mysql` 容器，只使用容器导出旧数据；新服务器的数据库仍然是原生 MySQL：

```bash
umask 077
docker exec qoj-mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF --hex-blob --default-character-set=utf8mb4 qoj' \
  > qoj-transfer.sql
```

确认导出命令退出码为 0，并保存 SQL 文件的 SHA256。数据库备份包含个人资料、密码哈希和系统设置密钥，请使用 SSH 传输，不要与公开部署包一起分享。

```bash
scp qoj-transfer.sql ubuntu@SERVER_IP:~/
```

### 在新服务器导入

在已解压部署包的目录运行：

```bash
SITE_URL=http://SERVER_IP
sudo bash scripts/install.sh "$SITE_URL" --migrate
```

配置脚本会提示输入旧服务的 `JWT_SECRET`，不会显示输入内容。数据库密码、Redis 密码、判题令牌及内部 Agent 令牌在新服务器重新生成。

安装准备完成后，后端尚未启动。导入旧数据库，再启动判题和后端：

```bash
sudo python3 /opt/qoj/current/scripts/restore-mysql.py "$PWD/../qoj-transfer.sql"

sudo bash /opt/qoj/current/scripts/install-docker.sh
sudo docker compose --env-file /etc/qoj/judge.env \
  -f /opt/qoj/current/judge/compose.yml up -d --build

sudo bash /opt/qoj/current/scripts/start.sh
```

上面的 SQL 路径假定包解压在家目录、SQL 也在家目录；如果位置不同，换成 SQL 的真实绝对路径。导入脚本只允许空目标数据库，遇到已有表会停止，避免覆盖数据。

已有 `flyway_schema_history` 会随备份恢复，后端只执行未执行过的后续迁移，包括课程、多班级、题单时间及比赛网段字段。若报告 checksum mismatch，应核对源服务器的迁移文件版本，不要直接清空 Flyway 历史或开启 baseline 跳过问题。

迁移后使用原管理员账号密码。图片由 COS 托管，保留 COS 存储桶与配置；MySQL 备份不会复制 COS 对象。Redis 令牌/任务进度没有默认迁移，用户可能需要重新登录。先等正在执行的 Agent 任务结束；独立出题 Agent 的 workspace 数据如需要保留，还要单独迁移其 volume。

## 4. 检查服务

```bash
sudo systemctl status mysql qoj-redis qoj-backend nginx --no-pager
sudo journalctl -u qoj-backend -n 100 --no-pager
sudo docker compose --env-file /etc/qoj/judge.env \
  -f /opt/qoj/current/judge/compose.yml ps
curl -I http://127.0.0.1/
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/api/v1/courses
curl -fsS http://127.0.0.1:15050/version
```

- 前端应返回 200。
- 未登录访问课程接口返回 401 是正常结果，表示后端已响应。
- go-judge 应为 `healthy`，`/version` 能返回版本信息。
- 登录后查看课程、比赛、题目，并用 A+B 题提交一次代码确认实际判题可用。

云服务器安全组开放 SSH 端口及 80/443。后端、Redis 和判题端口均绑定回环地址；本机 MySQL 保持系统默认回环监听。Nginx 会传递真实请求 IP，因此比赛网段限制能够使用访问者 IP。若还经过 CDN/另一层代理，需要在 Nginx 配置受信任代理的 `real_ip`，否则识别到的是代理地址。

## 5. 配置文件和日常维护

主要配置在 `/etc/qoj/backend.env`，文件权限 600，仅由 systemd 读取。不要把旧项目 `.env` 整份复制过来：开发端口、Docker 主机名及后台前缀可能与本包不同。

```bash
sudo nano /etc/qoj/backend.env
sudo systemctl restart qoj-backend
sudo journalctl -u qoj-backend -f
```

需要改判题令牌时，同时更新 `backend.env` 和 `judge.env` 后重建判题容器、重启后端；内部 Agent 令牌同理需要同步 `agent.env`。Redis 密码需同步 `backend.env` 和 `redis.conf`，然后重启对应服务。

系统设置中的 AI 地址/模型/密钥、邮件、COS、注册策略继续在后台配置。课程等后台聊天工具已在后端中，不依赖第 7 节的独立出题服务。

备份原生 MySQL：

```bash
sudo python3 /opt/qoj/current/scripts/backup-mysql.py /var/backups/qoj/qoj-20261006.sql
```

每次换一个输出文件名，脚本不会覆盖已有备份。另行备份 `/etc/qoj/`（包含密钥），以及 `/var/lib/qoj-redis/`（如需保留 Redis 持久化数据，停止实例后复制或使用 Redis 一致性快照）。

升级时上传新的部署包、解压，在新包目录执行：

```bash
sudo bash scripts/upgrade.sh
```

脚本检查后台前缀是否一致、停止后端、备份数据库，再切换 `/opt/qoj/current` 并重新启动。配置和密钥保留；Nginx 配置沿用已有站点配置，避免覆盖 HTTPS 证书设置。旧版本保留在 `/opt/qoj/releases/`。数据库执行过新迁移后，不能只切回旧 JAR 就宣称回滚完成，需要结合升级前数据库备份恢复。

升级后若需要更新可选独立 Agent，也执行第 7 节的 `up -d --build`。go-judge 版本发生变化时才需要重新构建对应镜像。

## 6. 域名与 HTTPS

域名 A 记录先解析到服务器，在安全组放行 80/443。安装包的 Nginx 配置初始监听 80。若安装时填写的是 IP，先编辑 `/etc/nginx/sites-available/qoj.conf`，将 `server_name` 改为 `oj.example.com`，再申请该域名的证书。Ubuntu 提供原生 [Certbot Nginx 插件软件包](https://packages.ubuntu.com/noble/python3-certbot-nginx)，可用以下命令配置：

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d oj.example.com
sudo nginx -t
sudo systemctl reload nginx
```

将 `/etc/qoj/backend.env` 中 `CORS_ALLOWED_ORIGINS` 更新为 `https://oj.example.com`，重启后端，随后从 HTTPS 域名登录。Nginx 已保留 WebSocket Upgrade 和聊天 SSE 禁用缓冲配置，申请证书时保留这些 location 块。证书安装与续期方法参考 [Certbot 官方 Nginx 教程](https://certbot.eff.org/instructions?ws=nginx&os=pip)。

## 7. 可选：独立出题 Agent

包内包含新编译的独立 Agent JAR，运行镜像自带 Java 17 和 PowerShell。当前仓库只提供 `agent-skills/README.md`，没有完整 ICPC Problem Creator 技能；本包也没有虚构或包含这份技能。

只有需要使用独立出题页面时，才补充完整技能目录：

```text
/opt/qoj/icpc-skill/SKILL.md
/opt/qoj/icpc-skill/scripts/run-all-tests.ps1
以及该技能所依赖的其他完整文件
```

技能目录应对容器中的 `nobody` 用户可读、目录可遍历，工作目录由隔离容器 volume 保存。随后执行：

```bash
sudo docker compose --env-file /etc/qoj/agent.env \
  -f /opt/qoj/current/optional-agent/compose.yml up -d --build
curl -fsS http://127.0.0.1:19090/healthz
```

此容器使用 Linux host networking 访问回环地址上的后端，自身仅监听 `127.0.0.1:19090`。前端通过同源 `/agent/` 访问。模型配置从后端当前系统设置获取；无需把 AI key 写入浏览器或 Compose 文件。未启动时独立出题页面不可用，普通后台聊天及课程管理可正常使用。

## 8. 常见问题

| 现象 | 处理 |
| --- | --- |
| checksum did NOT match | 执行 `sha256sum --quiet -c SHA256SUMS` 查看具体文件，从已校验原包恢复，或重新解压完整包到新目录 |
| /opt/qoj/current 或 judge.env 不存在 | `install.sh` 尚未完成，先处理安装错误；安装地址须包含 `http://`；判题环境文件路径为 `/etc/qoj/judge.env` |
| 后端连接 MySQL 失败 | 查看 `MYSQL_HOST/PORT/USERNAME/PASSWORD`；本包端口为 3306，不是开发环境的 13306；用 `sudo mysql` 检查专用账号授权 |
| 自动建库失败 | 脚本使用 Ubuntu 默认 root socket 登录；已有自定义 MySQL 请按原认证方式手动创建 utf8mb4 数据库及账号，脚本不会重置 root 密码 |
| Redis NOAUTH | 同步 `backend.env` 和 `/etc/qoj/redis.conf` 中的密码，重启 `qoj-redis` 与后端 |
| 502 | 检查 `systemctl status qoj-backend`；判题/独立 Agent 的 502 分别检查其容器 |
| 后台页面能打开但请求 404 | 后台前缀与 `build-info.json` 不一致；恢复本包前缀或重新打包前端 |
| 判题卡在等待/系统错误 | 查看 go-judge 是否 healthy、令牌是否一致、主机是否支持 cgroup；不要关闭 `-no-fallback` |
| Flyway 迁移失败 | 先保留备份，核对 MySQL 8.0/8.4 和旧 Flyway 历史；查看后端日志中的具体 migration |
| 已有 Docker，但 Compose 缺失 | 按 Docker 官方文档补装匹配的 Compose；脚本不会自动卸载运行中的 Docker |
| 服务器无法下载依赖或镜像 | 检查 apt、Docker registry 和 GitHub 网络；判题镜像需要从 GitHub 获取固定版本 go-judge，失败时不要换成未知二进制 |

自动脚本只在目标服务器运行，不能在当前 macOS 开发机执行。打包阶段完成前后端/Agent 构建与包内容检查；26.04 的软件包和安装命令已按官方文档核对，但没有在你的新服务器运行完整安装或完成实际提交验收。

## 两阶段通信题

本版本包含 V108 迁移，后端首次启动自动增加通信配置和接收方公开输入字段。
后台新建题目可下载并导入通信题示例包；编辑题目可选择“通信题（两阶段）”，填写消息上限、信道程序和最终检查器。
通信题继续使用现有 go-judge，不需要新增通信服务。完整说明见 [通信题文档](docs/communication-task-design.md)。
前端目录和后端 JAR 内嵌资源已校验一致；升级时同时替换两者。
