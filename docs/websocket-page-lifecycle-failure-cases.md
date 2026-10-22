# WebSocket 页面生命周期修复：实现前的失败场景

- 浏览器导航使页面进入 Back-Forward Cache，连接未主动关闭，恢复页面后连接不重建。
- pagehide 后 STOMP 自动重连仍运行；重复 pageshow 造成多个连接。
- 页面挂起期间新订阅发起连接；退出登录后 pageshow 重新连接旧账号。
- React StrictMode / 登录切换关闭旧连接后，旧连接错误、断开回调覆盖新连接状态。
- 关闭尚未完成 CONNECT 的连接，connect Promise 一直悬挂。
- 断开时发送 UNSUBSCRIBE / DISCONNECT 与服务器关闭竞态，产生 Session closed 错误。
- 真正的服务端 STOMP ERROR 只显示压缩后的类名，无法知道 message / body。
- 恢复后未重新订阅或未补拉断开期间广播；后台和选手行为不同。

验证：真实后端、MySQL/Redis、浏览器 E2E；保存生命周期、WebSocket 帧及测试报告。
区分真实浏览器缓存恢复与派发 PageTransitionEvent 的生命周期测试，不把模拟事件声称为实际缓存命中。

进一步核查心跳后的失败场景（心跳修复前补充）：

- 浏览器后台对页面 setInterval 限流，服务器收不到心跳，SimpleBroker 心跳任务触发 DISCONNECT_ACK，转换为 ERROR Session closed.，每次重连重复。
- 只忽略 Session closed. 日志，实际连接仍不稳定。
- 使用 Worker 后未发出真实心跳，或恢复/注销时遗留 Worker。
- 缓存恢复 / 普通重连丢失原有判题、榜单等订阅。
