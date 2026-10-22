# 比赛答疑 WebSocket 验证范围

实现前列出的失败场景：

- 空闲状态继续请求消息列表，或切换比赛介绍/编辑器后重复建立连接。
- 推送早于数据库事务提交，导致消息不可补拉；重试造成重复消息。
- 未报名、待审核、已撤销报名、无关教师或受限 IP 收到广播/私信。
- 不同账号类型使用相同数字 ID 时串号；猜测 session/user destination 越权订阅。
- 客户端直接向 broker 发送伪造广播。
- 断线期间消息丢失，重连没有重新订阅或没有补拉；先推送较新消息导致补拉游标跳跃。
- 页面关闭或注销后连接/订阅继续残留；JWT 过期后不能重新认证。
- WebSocket 未开启时退回 HTTP 定时轮询，重新产生持续请求。
- 后台绕过 adminGet/adminPost 的统一历史接口前缀规则。
- 推送抢走编辑器焦点、打断输入。

验证使用真实 Spring MVC/WebSocket、MySQL、Redis 与浏览器 E2E，保留报告、网络证据和截图；不新增单元测试。HTTP 保留历史读取和已读状态接口，移除消息定时轮询。数据库写入成功并提交后才推送。

## 实现与复现

- `node tools/e2e/contest-messaging.mjs`：真实数据库、REST、浏览器和原生 STOMP 联合验证。脚本仅创建/清理自身测试记录。
- 报告：`output/contest-messaging-e2e/report.json`。
- 网络证据：`output/contest-messaging-e2e/websocket-network.json`，记录消息列表请求、WebSocket 命令和推送内容，不记录 CONNECT Authorization。
- 实测连续空闲 12 秒没有消息列表请求；页面切换复用连接；离线期间广播在重连后补齐。
- UI 提问/回复/广播使用 `/app/contest-messages/send` 和逐请求回执。HTTP 历史接口仍遵循公共 `adminPath` 前缀规则，无回退地址。
- 私有推送使用 Spring 的 `/user/queue/contest-messages`，内部按 session 定向发送，不用多账号表中的数字 ID 作为唯一收件地址。每次推送重新查询通过报名、管理员角色、教师状态、比赛归属、IP 限制及 token 撤销状态。
- 连接就绪确认完成后才补拉历史；推送不推进历史游标，避免漏掉离线消息。消息按 ID 去重。
- JWT 到期前重连，复用现有刷新令牌流程。注销关闭连接；心跳为连接健康检测，不访问消息表。
- 初次未认证、未报名或历史接口 404 后停止自动历史请求；断线只重连 WebSocket，不回退 HTTP 轮询。
- 原先专用于 HTTP 轮询和地址回退的两个浏览器脚本已移除，相关验证由上述真实端到端脚本取代。

## 部署

需要同时更新前端与后端 JAR。Nginx 必须将 `/ws` 转发到后端并保留 `Upgrade` / `Connection` 请求头；项目的原生和宝塔 Nginx 模板已包含该配置。没有新增数据库迁移（继续使用 V106 的消息表）。

目前复用项目已有 Spring SimpleBroker，适用于单后端实例；多实例部署需要共享消息代理和会话路由。
