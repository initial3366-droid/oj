# go-judge 与 CCPCOJ 迁移及安全部署

## 当前架构

- 普通题、练习和自定义输入固定由 Spring 后端调用 `criyle/go-judge v1.12.1`。
- 比赛提交固定由 CCPCOJ worker 通过 `/ojtool/judge` 拉取。
- 两条链路复用现有提交表、状态机、排行榜、回调服务和 WebSocket，不改变比赛业务模型。
- 浏览器不能获取或调用 go-judge 地址和令牌；这些值只来自后端环境变量。

## 数据库迁移

V65 将 `judge.mode` 固定为 `go-judge`，将 `judge.contest_mode` 固定为 `ccpcoj`，删除旧判题设置，并条件删除三张表中的历史外部 ID 字段。历史提交保留，旧判题机名称统一为 `LEGACY`。

升级前使用 `mysqldump --single-transaction` 备份。升级后检查：

```sql
SELECT version, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;
SELECT setting_key, setting_value FROM system_settings
WHERE setting_key IN ('judge.mode', 'judge.contest_mode');
```

## go-judge 部署

```bash
cd docker/go-judge
umask 077
cp .env.example .env
openssl rand -hex 32
# 将生成值写入 GO_JUDGE_AUTH_TOKEN，并在后端使用相同值。
docker compose up -d --build
```

后端环境：

```bash
GO_JUDGE_BASE_URL=http://127.0.0.1:15050
GO_JUDGE_AUTH_TOKEN=<64-character-random-hex>
```

生产环境必须使用独立 Linux 主机或 VM。go-judge 只绑定回环或私网地址，防火墙仅允许应用后端访问；评测主机不得保存数据库、JWT、对象存储或备份凭据。上游 `/version` 端点不校验 Token，因此不能用它验证鉴权状态。Docker 的 `privileged` 权限只授予专用评测容器，不能与业务服务共享宿主机信任边界。

默认 2 GiB 容器只运行一个沙箱。提高 `GO_JUDGE_PARALLELISM` 前必须按“并发数 x 单题最大内存 + 编译器与沙箱开销”同步扩容容器和宿主机。服务以 `-silent` 运行，避免启动日志记录认证参数；同时必须限制 Docker socket 和 Docker 管理员权限，因为具有容器检查权限的账号本身等同于评测主机 root 权限。

## 安全边界

- 仅允许 C、C++17、Java 17、Python 3；语言名在提交入口和执行器内双重校验。
- 命令、参数、环境变量、文件名和缓存 ID 均由服务端生成，源码和输入不会进入 shell 参数。
- CPU、墙钟、内存、栈、进程、输入、输出、源码和 HTTP 响应体均有限制。
- 每个测试点单独请求；go-judge 的多命令并发组不会被用于批量测试点，避免资源放大。
- `/run` 不自动重试，防止同一任务被重复执行；编译缓存无论成功或异常都会删除。
- CCPCOJ Session 存于 Redis，领取、源码、隐藏测试数据和结果回调均校验当前 worker 所有权。
- MyBatis 查询使用绑定参数；动态排序只允许后端固定列白名单。

## 运维影响

- go-judge 不可用时，普通提交会记录系统错误，不会回退到宿主机执行。
- CCPCOJ 不可用时，比赛提交保持在可重新领取的队列状态，不会被 go-judge 抢占。
- 题目时间限制为 100-60000ms，内存限制为 16-1024MB；部署资源必须覆盖配置的并发数与单题上限。
- Token 轮换需要同时重启 go-judge 和后端。不要把 Token 写入源码、日志、工单或浏览器配置。
- 修改 CCPCOJ 评测机账号或密码会立即使旧 worker Cookie 失效，评测机必须重新登录。
