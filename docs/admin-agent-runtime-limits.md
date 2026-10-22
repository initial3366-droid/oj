# 后台 Agent 的长任务运行限制

公开 SDK 没有统一的“行业中断阈值”。Anthropic TypeScript SDK 默认请求超时为 10 分钟；OpenAI Agents SDK 支持自定义 max_turns，包括关闭轮数上限。本项目选用有界长任务运行策略。

参考：https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript 、https://openai.github.io/openai-agents-python/running_agents/

实施前检查的失败场景：

- 数据库保留旧的 30 秒超时，后台 Agent 仍在长思考期间中断。
- 模型 90 秒请求上限、120 秒 SDK 传输上限或 100 秒执行段仍先于新的空闲超时触发。
- 超过 32 次调用、40 轮、8 个执行段后，正常任务被频繁要求手动继续。
- 放宽时间后，150 秒 Redis 锁先过期，同一任务可被并发续跑。
- 浏览器 SSE、Spring 异步请求、Nginx 代理仍在 150～180 秒断开。
- 手动停止长思考无法及时生效，或拒绝审批后继续执行。
- 重复无进展的调用失去终止保护；恢复状态丢失或成功操作重做。

目标限制：后台模型连续无数据至少允许 5 分钟（配置可提高到 10 分钟），单请求最多 10 分钟；执行段 15 分钟、256 次工具调用、200 轮；自动最多 32 段或约 1 小时，在段边界暂停并保留续跑。重复无进展 16 次仍停止。Redis 执行租约、Spring 和浏览器 SSE 上限 20 分钟，代理读超时同步。

旧的系统设置无需重新保存，后台 Agent 的空闲等待下限自动生效。共享的普通 AI 助手仍使用其明确配置的空闲超时；后台 Agent 使用独立长任务下限。

部署需更新前后端并将 Nginx 的 Agent SSE location 中 proxy_read_timeout/proxy_send_timeout 更新为 1200s，再校验并 reload。
