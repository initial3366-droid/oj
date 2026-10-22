# Agent 聊天超时修复与验证

2026-10-10，修复超时排查中提出的四项问题。

## 行为变化

- SDK 超时识别沿 cause 链检查，支持 Reactor TimeoutException、SocketTimeoutException、HttpTimeoutException、明确表示 timeout 的 InterruptedIOException，以及上游 HTTP 408/504。普通 400、EOF、主动停止不归类为超时。原因链使用对象身份集合防止循环。后台执行段到期仍保留原来的 checkpoint/continue 行为。
- 聊天页面将回复、AI 命名、记录保存错误分别保存在对应会话下并分别展示。附加错误不能覆盖回复错误，旧会话的异步命名失败不会出现在新会话。下一次发送清除本会话之前的回复/保存提示；命名请求自行清除自己的提示。
- 后台 SSE 每 15 秒发送 `: heartbeat` 注释帧，不进入消息内容。心跳和业务事件共享同一把写锁，写完同时 flush writer 与 Servlet response；后者避免数据留在响应缓冲中，直到模型结束才到达客户端。连接写失败会取消心跳，并通知模型/工具取消检查；请求结束时取消定时任务。心跳不延长模型空闲时限或浏览器总时限。
- 浏览器超时 E2E 更新为 1200000ms，验证阈值前仍在运行、阈值后终止，以及持续输出/心跳不能延长总时限。回归刷新恢复时显式从历史列表打开会话，并等待命名请求结束后才推进虚拟时钟。

未调整现有 5～10 分钟模型空闲时限、10 分钟模型总时限、15 分钟执行段预算和 20 分钟浏览器总时限。

## 验证与复现

依赖：本地 MySQL/Redis、配置完整的 .env、Node、Maven、Playwright。使用临时账号与本地确定性模型服务，不调用收费模型。禁止在生产数据库运行 E2E。

```sh
npm run build
(cd backend && mvn -q package)
QOJ_E2E_SCRIPTED_AGENT=1 QOJ_E2E_TIMEOUT_ONLY=1 QOJ_E2E_FIXTURE_PORT=18084 QOJ_E2E_OUTPUT_DIR=output/agent-timeout-fix-e2e node tools/e2e/admin-ai-stream.mjs
python3 tools/diagnostics/verify-agent-timeout-fix.py
```

结果：10 项 E2E 全部通过，177 项现有后端测试通过，前端构建通过；未新增单元测试。SDK socket 超时测试只将该本地场景的实际 HTTP socket read timeout 缩短至 100ms，保留真实 SDK 包装和业务处理；20 分钟浏览器边界使用 Playwright 虚拟时钟。没有将其描述成生产服务器长时间实测。

真实 MVC 心跳场景并行运行两个请求：响应头分别在 14ms/25ms 到达，15 秒收到心跳后主动断开第一条连接；第一条模型被取消并保存 stopped，第二条正常保存 complete；结束后心跳调度队列为 0。本次日期内的测试账号清理结果由只读 SQL 再次验证，之前留下的历史测试账号未改动。

证据：

- [10 项 E2E 报告](/Users/initial/qoj/output/agent-timeout-fix-e2e/report.json)
- [构建、源码哈希与清理验证](/Users/initial/qoj/output/agent-timeout-fix-e2e/verification.json)
- [三个错误同时保留的截图](/Users/initial/qoj/output/agent-timeout-fix-e2e/separate-errors.png)
- [真实 SDK 超时事件](/Users/initial/qoj/output/agent-timeout-fix-e2e/sdk-wrapped-timeout.sse)
- [HTTP 状态分类证据](/Users/initial/qoj/output/agent-timeout-fix-e2e/sdk-http-statuses.json)
- [心跳时间记录](/Users/initial/qoj/output/agent-timeout-fix-e2e/heartbeat-timing.json)
- [心跳与模型清理记录](/Users/initial/qoj/output/agent-timeout-fix-e2e/heartbeat-cleanup.json)

前端 dist 与后端 target/qoj-backend-0.1.0.jar 已重新构建。本次没有部署线上服务；部署时需同时更新前后端并重启后端。此前 release 中的旧部署包不包含本次修复。
