# QOJ DOMjudge 部署说明

这套配置将 DOMjudge 作为独立判题服务部署，QOJ 后端通过 DOMjudge API 提交代码并轮询结果。数据库容器使用 `mariadb:10.11`，避免和 QOJ 主库混用。

> 注意：DOMjudge `judgehost` 需要 Linux cgroup 权限。macOS Docker Desktop 上可能因为 `/sys/fs/cgroup` 只读而反复重启；正式部署请放到 Linux 服务器运行。

## 1. 准备配置

```bash
cd docker/domjudge
cp .env.example .env
```

编辑 `.env`，把所有 `change-*` 密码改成强密码。

## 2. 启动 DOMjudge

```bash
docker compose up -d
```

默认访问地址：

```text
http://服务器IP:8081
```

如果服务器已有服务占用 `8081`，修改 `.env` 中的 `DOMJUDGE_PORT`。

## 3. 查看初始账号和日志

```bash
docker compose logs -f domserver
docker compose logs -f judgehost
```

DOMjudge 首次启动会在日志或初始化页面中给出管理员登录信息。登录后请立即修改管理员密码。

## 4. 配置 judgehost

在 DOMjudge 后台确认 `judgedaemon` 用户的密码，与 `.env` 中的 `JUDGEDAEMON_PASSWORD` 保持一致。修改后重启：

```bash
docker compose restart judgehost
```

## 5. 创建 QOJ 使用的比赛

QOJ 需要一个 DOMjudge contest id 作为普通提交的默认比赛。登录 DOMjudge 后创建一个长期比赛，并记录 contest id。

题目需要在 DOMjudge 中有对应 problem id。QOJ 的题目字段 `domjudge_problem_id` 为空时，会默认使用 QOJ 题目 ID 作为 DOMjudge problem id。

## 6. 修改 QOJ 后端环境变量

参考 `qoj-domjudge.env.example`，至少设置：

```env
QOJ_JUDGE_MODE=domjudge
ENABLE_UNSAFE_LOCAL_JUDGE=false
ENABLE_SANDBOX=false
DOMJUDGE_BASE_URL=http://127.0.0.1:8081
DOMJUDGE_API_KEY=你的DOMjudge API Key
DOMJUDGE_DEFAULT_CONTEST_ID=你的DOMjudge比赛ID
```

修改 QOJ 后端 `.env` 后重启后端服务。

## 7. 验证

```bash
curl -I http://127.0.0.1:8081
docker compose ps
```

QOJ 后台提交队列中，使用 DOMjudge 判题的提交会记录 `judgeServer=DOMJUDGE` 和 `domjudgeSubmissionId`。
