# 独立出题服务的 405 部署故障

2026-10-12 通过无认证 HTTP 请求核对用户提供的站点：

- `GET /agent/healthz` 返回 200、`text/html` 和前端入口，而正确结果应为 JSON `{"status":"ok"}`。
- `POST /agent/v1/problem/generate`（空 JSON，不携带令牌，不会调用模型）返回 Nginx 的 HTML 405 页面。
- `GET /api/v1/settings/frontend` 返回正常 JSON，主后端 API 转发工作正常。

这些响应说明 `/agent/` 被前端静态站点处理，未正确进入独立出题服务。需要修改实际监听 1205 的 Nginx `server`，不能仅修改另一个未启用的站点配置。以下是修复前列出的失败情形：

1. 缺少 Agent location：GET 回退首页，POST 返回 405。
2. `proxy_pass` 缺少尾部 `/`：Agent 收到错误的 `/agent/v1/...` 路径。
3. 其他正则 location 抢占 `/agent/`：使用 `location ^~ /agent/`。
4. Agent 未启动：配置生效后返回 502；先从服务器回环地址检查 `/healthz`。
5. 认证未传递：合法出题请求到达 Agent 后必须仍然验证管理员身份；不能通过去掉鉴权绕过。
6. SSE 缓冲或短超时：关闭缓冲和缓存，保留长连接。

可复制的配置是 `deploy/baota/agent-location.conf`，加入现有站点的 `server {}` 内；若已有 `/agent/` location，替换该段。保留 `proxy_pass` 的尾部 `/`。先执行 `curl -i http://127.0.0.1:19090/healthz` 确认独立 Agent 已启动，再执行服务器上的 `nginx -t` 和 `nginx -s reload`。公开健康检查 `curl -i http://36.137.172.149:1205/agent/healthz` 应返回 JSON。

如需安装独立服务，按 `deploy/native/README.md` 的“可选：独立出题 Agent”章节操作；主后端 JAR 本身不提供 `/agent/v1/problem/generate`。

可重复验证：`node tools/e2e/ai-generator-proxy.mjs`。需要本地 Docker 的 `nginx:1.29.7-alpine` 镜像及运行在 `127.0.0.1:19090` 的实际 Java Agent。验证不调用模型，不写数据库，只创建并清理本次 Nginx 容器；日志、实际响应、测试配置和报告保留在 `output/ai-generator-proxy-e2e/`。
