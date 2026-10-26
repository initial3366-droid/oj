# 后台 Agent 上下文与布局

当前上下文采用结构化任务状态、历史背景压缩及近期完整消息。完整聊天仍保存在当前浏览器的 IndexedDB，按账号隔离。旧的自由文本摘要仍可加载，下一次压缩时转换为结构化状态。

## 压缩

- 前端每次发送前重新读取模型窗口设置。预算扣除输出预留及安全余量；估算或上次真实输入超过预算的 80% 时尝试压缩。
- 保留最近约 12 条消息，沿用户轮次边界调整；最新用户请求不参与压缩。旧消息分批与已有状态合并。
- 固定 JSON 字符串字段：`goal`、`constraints`、`decisions`、`objects`、`completed`、`pending`、`failures`、`references`、`background`。
- 提示模型保留最新相关查询、写操作结果、错误、未知状态和关键对象引用，删除重复解释与无关背景。不会创建不存在的外部资料引用。
- 后端检查字段、类型、空目标、重复 JSON 键、尾随内容以及 12000 字符上限。校验成功且最终上下文在预算内，才替换前端摘要位置。
- 同一次 Agent 执行中的旧工具历史另行压缩，保留最新完整调用与结果轮次。执行记录、幂等性记录、审批状态保持独立，不由模型摘要覆盖。

## 百分比

显示 `当前输入 + 当前输出` 占模型窗口的百分比，每次模型调用**替换**当前统计，不累加历史请求。历史 `providerInputTokens` 累计值不再参与显示。未获服务商统计时使用估算；悬停查看 token 数与估算标记。

压缩完成立即更新为“任务状态＋近期消息”的估算量，之后由后端包含系统消息与工具定义的估算、服务商真实统计依次校准。服务商不返回 usage 时，完成回复后估算输出。

这是当前上下文占用，不是账单累计消耗。压缩不会退还已消费 token。超过 100% 时如实显示，不将数字强行截成 100%。本地估算不是模型精确 tokenizer。

## 布局

独立会话侧栏、居中助手回复、用户消息气泡、底部输入框。消息与审批内容在历史区域滚动；代码块和表格横向滚动；附件区域独立限制高度。手机侧栏缩成横向区域。现有思考与进度事件处理保持原样。

## 可复现验证

先启动前端：`npm run dev`。

```sh
QOJ_FRONTEND_URL=http://127.0.0.1:5173 \
CHROMIUM_PATH=/absolute/path/to/chromium \
node tools/verify-agent-local-context.mjs

python3 tools/verify-agent-compaction-http.py
npm run build
npm run verify:template
mvn -f tools/java-style/pom.xml formatter:validate
```

浏览器验证使用 API fixtures，覆盖多轮统计替换、压缩、失败保留、停止、审批、刷新、账号隔离、桌面和手机短屏布局；产物为 `.runtime/chat-context/e2e/report.json`、`trace.zip` 和截图。

HTTP 集成验证使用独立的本地模拟模型服务，运行真实 Spring AI SDK 与 Agent 调用循环，覆盖结构化工具压缩、调用结果配对保留、审批和执行记录保留、真实协议 usage 解析、缺失 usage 回退和非法摘要拒绝；产物为 `.runtime/chat-context/backend-e2e-report.json`。

以上验证不调用真实模型，也不修改后台 AI 配置或运行中的后端服务。前后端需要一并部署新版本。
