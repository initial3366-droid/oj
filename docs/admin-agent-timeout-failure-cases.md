# Agent 超时修复：实现前失败场景

本次范围为超时异常识别、页面错误隔离、SSE 心跳、现行时限的 E2E。实现前列出以下失败方式：

- SDK 将 SocketTimeoutException / HttpTimeoutException / InterruptedIOException(timeout) 包在 OpenAIIoException 内，页面错误地显示配置失败；不能把主动取消、普通 EOF、连接拒绝都当作超时。
- cause 链有环，异常判断陷入死循环；单段到期应仍走 checkpoint/continue，不变成失败。
- 回复错误随后被命名或保存错误覆盖；上一会话异步命名失败污染新会话；附加错误不能影响正在进行的回复。
- 多线程 heartbeat 与 delta/error/done 交错破坏 SSE；客户端断开后定时器泄漏；响应关闭后继续写；心跳写失败不能静默留下任务无限执行。
- 心跳刷新前端空闲计时器，但不得刷新总计时器；模型无响应仍应受模型自己的空闲限制。
- 旧测试快进 151/181 秒，对 1200 秒阈值失效；更新后应检查阈值前不终止、达到总时限终止、活跃流同样终止、手动停止与 EOF 保持独立状态。

验证优先复用真实浏览器、HTTP SSE、Spring MVC、MySQL 的 E2E，并保存可重复运行脚本、报告、事件和截图。现有后端测试先执行；不在实现后新增单元测试。
