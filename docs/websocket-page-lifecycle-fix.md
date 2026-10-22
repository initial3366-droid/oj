# WebSocket Session closed 与页面缓存断连修复

## 日志含义及证据

- `Gi` 是构建压缩后的 STOMP Frame 类名；实际原因在 frame.headers.message，本例为 `Session closed.`。
- `Page entered Back-Forward Cache` 表示浏览器因页面进入往返缓存关闭连接。原客户端没有 pagehide/pageshow 生命周期处理，浏览器恢复页面时无法可靠重建消息连接。
- 当前实际后端依赖 Spring WebSocket / Messaging 7.0.9。`StompSubProtocolHandler.java:564–572` 将不带 receipt 的 DISCONNECT_ACK 转为 `ERROR message:Session closed.`。该消息不是“资源不存在”，也不是 Agent 模型调用超时。
- `SimpleBrokerMessageHandler.java:434,458–459,514–515` 显示，SimpleBroker 对客户端心跳使用 3 倍宽限；10 秒心跳意味着超过 30 秒未读到数据后，在心跳检查时关闭会话并发送 DISCONNECT_ACK。正常断开通常带 receipt，会返回 RECEIPT。
- 旧版 STOMP 7.0.0 使用页面 setInterval 发送心跳。页面后台限流可能使心跳延迟。此路径可以产生用户的 Session closed 日志，但没有线上服务器相应时间段日志，不能断言线上每次错误都来自心跳超时。

提取自本机依赖的源码证据：`output/websocket-lifecycle-e2e/StompSubProtocolHandler.java`、`SimpleBrokerMessageHandler.java`。

## 修复

- STOMP 固定升级至 7.3.0，使用 `TickerStrategy.Worker` 发送 10 秒心跳。官方建议 Worker 用于后台/长时间运行页面：https://stomp-js.github.io/guide/stompjs/using-stompjs-v5.html 。Worker 减少页面定时器限流影响，操作系统彻底冻结页面时仍需恢复重连。
- pagehide 主动停止连接与重连任务，pageshow 恢复已登录连接；重复 pageshow 不增加连接。挂起期间退出登录，恢复时不连接旧账号。
- 断开连接时直接关闭传输，不再向关闭中的会话发送清理帧；服务器通过连接关闭清理订阅。
- 所有旧连接错误/断开回调按连接代次隔离；取消仍在建立的连接会结束相应 Promise。
- 缓存恢复和普通断线重连都恢复原有判题、比赛榜单/状态订阅；比赛答疑继续通过 ready 回执后补拉遗漏消息。
- 真正的 STOMP ERROR 直接打印 message/body，保留错误诊断。

## 复现与验证

```sh
npm run build
QOJ_E2E_OUTPUT_DIR=output/websocket-lifecycle-e2e node tools/e2e/contest-messaging.mjs
```

浏览器 E2E 使用真实 Spring 后端、MySQL、Redis 和 WebSocket。暂停页面定时器 35 秒，检查 Worker 至少发送 3 次真实心跳、连接没有被替换、仍能收到广播；生命周期用 PageTransitionEvent 模拟 pagehide/pageshow，并检查真实连接暂停/恢复、订阅恢复、遗漏广播补拉与退出登录。本测试不将模拟生命周期声称为实际浏览器缓存命中。

报告 `output/websocket-lifecycle-e2e/report.json`；生命周期/心跳证据 `page-lifecycle.json`；WebSocket 帧及 HTTP 消息请求证据 `websocket-network.json`（不保存 CONNECT Authorization）；测试数据清理结果 `cleanup.json`。

本次修改仅涉及前端源码和依赖。前端 dist 已重新构建，尚未部署线上；此前 release 包不包含本次修复。生产需替换前端构建产物。

验证结果：17 项 E2E 全部通过，前端 TypeScript / Vite 构建通过；35 秒页面定时器暂停期间发出 3 次真实心跳、没有重连且广播收到；选手/后台各恢复 2 次且没有额外连接或 WebSocket 错误；挂起后退出登录没有误重连；本次测试账号和比赛已清理为 0。`verification.json` 记录结果与源文件/构建入口 SHA-256。
