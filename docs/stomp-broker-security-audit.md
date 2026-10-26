# STOMP Broker SEND 消息注入修复（2026-10-25）

## 确认与修复

当前 `WebSocketSubscriptionInterceptor` 仅对 destination 包含 `contest-message` 的 SEND 做局部校验，其他 SEND 直接放行；CONNECT 认证和 SUBSCRIBE 权限检查并不能阻止客户端向 broker 直接发布。

本次在客户端入站通道对所有 SEND 默认拒绝，只允许以下两个精确匹配、已认证的业务入口：

- `/app/contest-messages/send`
- `/app/contest-messages/ready`

对 `/topic/**`、`/queue/**`、`/user/**`、未知 `/app/**`、路径后缀等非法发布目标，不区分角色一律丢弃并关闭连接（策略违规）。服务端通过 `SimpMessagingTemplate` 发布不经过此客户端入站限制。业务入口继续执行原有参数、角色、比赛管理权限、登录过期和撤销检查。

实测仅抛异常未能在当前有序消息通道及时产生客户端可见 ERROR，因此复用 native/SockJS 会话管理器显式关闭非法发布连接，避免静默等待。`UserSocketSessions.reject` 增加带固定原因的重载，原账号封禁关闭行为保留。

同时对 SUBSCRIBE 缺少 session attributes 的情况安全拒绝，避免空指针。现有订阅权限规则与客户端协议未改变。

## 验证结果

```sh
mvn -q -f backend/pom.xml test
python3 tools/verify-stomp-broker-http.py
```

- 现有后端测试：189 项通过，0 失败/错误，未新增单元测试。
- 真实 HTTP 登录 + WebSocket/SockJS STOMP：23 项检查通过。
- 学生、教师、管理员分别向队列及比赛 announcements/status/scoreboard 直接 SEND：12 项全部断开，独立学生接收端未收到注入消息。
- 直接发布至 `/queue/forged`、`/user/queue/contest-messages`、未知应用路径、合法路径后缀、`/topic`、未知前缀：全部拒绝。
- SockJS 直接向 broker SEND 同样拒绝。
- 合法 native 订阅和 ready 确认、合法 SockJS ready 确认仍可用。
- 学生经业务入口发 BROADCAST 返回 403，消息未落库。
- 比赛所属教师经业务入口发 BROADCAST 返回 200，消息持久化且通过私有订阅投递给已报名学生。

验证脚本需要本地 Docker MySQL/Redis、Maven、Python `bcrypt` 与 `websocket-client`，并要求 Redis DB15 为空。脚本使用临时后端、临时数据库和测试账户，结束后停止实例、删除数据库并清理专用 Redis DB15 的测试键；不接触公网目标。

可核验报告：`.runtime/security-remediation/stomp-broker-report.json`；后端执行日志：`.runtime/security-remediation/stomp-backend.log`。报告记录每项拒绝、跨用户投递结果以及合法业务行为，不输出令牌或密码。

## 发布边界

仅完成源码修复及本地验证；原有本地 18080 后端与公网生产均未重启或替换。部署时构建并重启实际后端，再以受控账号验证拒绝直接发布和合法广播两条链路。不需要数据库迁移或前端协议变更。

后续新增 `@MessageMapping` 时必须同时审查并更新精确 SEND 白名单；不要把整个 `/app/**` 前缀开放。
