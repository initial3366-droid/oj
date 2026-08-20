# QOJ 比赛压测脚本

这个脚本模拟多个普通学生账号登录比赛，并在同一个释放点向同一场比赛的同一道题提交代码。默认支持最多 100 个用户、代理池轮换、可选报名、可选等待判题完成，以及 JSON/HTML 报告。

脚本默认是 dry-run，不会访问网站，也不会访问代理接口。真正对线上站点发压必须显式传入 `--execute --confirm-online`，并且默认要求配置代理池。

## 1. 准备依赖和配置

在仓库根目录执行：

```bash
python3 -m pip install -r tools/contest-loadtest/requirements.txt
cp tools/contest-loadtest/.env.example tools/contest-loadtest/loadtest.env
cp tools/contest-loadtest/accounts.csv.example tools/contest-loadtest/accounts.csv
```

然后编辑 `loadtest.env`、`accounts.csv` 和提交源码文件：

- `QOJ_BASE_URL`：网站根地址，例如 `https://oj.example.com`。
- `QOJ_CONTEST_ID`：比赛 ID。
- `QOJ_PROBLEM_ID`：比赛题目 ID。QOJ 比赛提交通常传 `contest_problems.id`，不是题库原始 `problem.id`。
- `QOJ_ACCOUNTS_FILE`：CSV 文件，必须有 `username,password` 表头和至少 100 个不同的普通学生账号。
- `QOJ_PROXY_API_URL`：代理池地址。代理密钥只放在本地 env 文件或环境变量中，不要提交、截图或写入报告。
- `QOJ_CODE_FILE`：要提交的源码。没有传入时会使用一个最小源码，通常只能验证请求链路，不能保证题目答案正确。

你提供的代理接口每次返回 10 个代理，脚本会按 `--proxy-batch-size 10` 分批获取，最多获取到 100 个；如果实际只拿到 10 个，就会按轮询方式复用，并在报告中标记 `proxyReuse: true`。每个代理同时最多承载 10 个请求，避免把单个代理瞬间打满。

## 2. 先做本地校验

```bash
python3 tools/contest-loadtest/contest_load_test.py \
  --env-file tools/contest-loadtest/loadtest.env
```

这一步只读取本地账号和代码，不会发网络请求，也不会打印密码。

## 3. 线上压测命令

### 已提前报名

```bash
python3 tools/contest-loadtest/contest_load_test.py \
  --env-file tools/contest-loadtest/loadtest.env \
  --users 100 \
  --no-register \
  --execute --confirm-online
```

### 让脚本先报名再提交

```bash
python3 tools/contest-loadtest/contest_load_test.py \
  --env-file tools/contest-loadtest/loadtest.env \
  --users 100 \
  --register \
  --execute --confirm-online
```

默认 `ramp-up-seconds=0` 和 `submit-jitter-ms=0`，登录/报名完成后会尽可能同时提交。若线上环境不希望瞬时 100 个请求，可以设置例如 `--ramp-up-seconds 10`。

如需观察判题吞吐，可追加：

```bash
--wait-for-results --result-timeout-seconds 300 --poll-interval-seconds 2
```

轮询只对已经成功创建的提交执行，默认最多 20 个轮询请求并发；提交请求不自动重试。QOJ 对同一用户有待判提交 Redis key 和每分钟提交频率限制，所以脚本默认每个用户只提交一次，遇到 429 会如实计入报告，不会重复提交放大锁竞争。

## 4. 报告

执行成功后会在 `tools/contest-loadtest/reports/` 生成：

- `contest-loadtest-*.json`：完整请求记录、各阶段延迟 P50/P95/P99、HTTP 状态、每个用户结果。
- `contest-loadtest-*.html`：可直接用浏览器打开的汇总报告。

报告只保存脱敏用户名、代理编号和状态信息，不保存密码、JWT、代理完整地址或响应正文。

## 注意事项

- 只对你拥有或明确获授权的站点执行线上压测，并提前确认 CDN、WAF、代理商和云厂商的流量政策。
- 这不是无限压测工具：脚本硬限制 `--users` 最大为 100，避免误配置造成更大流量。
- 如果 100 个账号没有全部登录/报名成功，默认不会发送任何提交；如确实要测部分成功用户，可显式使用 `--allow-partial`。
- 代理接口包含密钥时，建议测试后立即更换或撤销该密钥，并清理 shell 历史和本地报告备份。
