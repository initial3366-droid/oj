# AI 聊天文件解析与题库导入

后台 AI 聊天的文本框左侧提供「上传附件」，也支持粘贴文件。上传后在文本框上方显示文件卡片，可查看文件清单、提取的文字、下载原文件或删除。发送后附件随聊天历史保存，刷新可以恢复。

核心是 ReAct 操作流程：模型结合用户目标自主选择工具，服务端执行操作并返回真实结果，模型依据结果继续读取、调整配对、生成方案或完成导入。后端负责解压和提取文字。ZIP 不要求固定目录或标准文件名；可以在消息中说明「初始输入.txt 是输入，参考结果.txt 是答案」帮助模型识别。

直接在聊天中发送「检查这些文件并整理到题库」即可启动 Agent。回复显示执行摘要与「查看并确认导入方案」入口；打开后可核对和修改。确认时将审核快照作为本次请求的授权交给 Agent，Agent 调用导入工具并观察实际结果，返回题目 ID 与未发布状态。刷新后保留执行摘要、方案入口与导入结果。只询问附件内容时，Agent 读取文件后直接回答。

点击「AI 整理并导入题库」后展示 AI 的解析结果。可以选择题目、修改标题与题面、调整限制和样例、核对或修改测试点配对，最后确认导入本地题库。所有新题目强制保存为 `DRAFT` 且非公开，用户确认后才写入题库。缺失答案会阻止普通判题题目导入；已有特殊判题代码的题目支持无标准答案。

AI 只返回测试文件引用。入库使用引用的原文件文本，不让模型重写测试数据或推算缺失答案。同一导入计划重复提交返回已创建的题目，多题导入任何一题失败则整体回滚。

## 支持范围与限制

| 类型 | 处理方式 |
| --- | --- |
| ZIP（包括嵌套 ZIP） | 展开目录，保留完整路径，交给 AI 分组和配对 |
| PDF | 提取文字，最多前 100 页；扫描版暂无 OCR |
| DOCX | 提取段落和表格；内嵌图片提示补充上传 |
| XLSX / XLS | 提取格式化单元格文字，不重新计算公式 |
| Markdown / HTML / JSON / TXT / CSV / XML / YAML / LaTeX | 提取文字供模型理解 |
| `.in` / `.out` / `.ans` 与常见代码文件 | 保留原文，可作为数据文件或辅助材料 |

图片继续使用原有视觉接口，见 [图片接口说明](admin-ai-chat-images.md)。每条消息最多 4 个附件，图片与其他文件合计。其他文件单个最多 50 MiB，图片单个最多 5 MiB。

ZIP 最多 500 个文件、累计展开大小 50 MiB、3 层嵌套；拒绝非法路径与重复路径。RAR、7z 需要先转 ZIP。文字支持 UTF-8、带 BOM 的 UTF-16 和 GB18030。PDF、Word 等文档提取最多 60,000 字符，截断会提示；原文件仍完整保存。纯文本完整保留，任意文本扩展名均可由 AI 判断为测试数据。Agent 每次最多读取 12,000 字符，可按偏移分页或查看末尾，每轮任务累计读取最多 60,000 字符；模型读取范围不影响原始测试数据的入库长度。每次最多导入 20 道题，每道最多 200 个测试点。

原文件、导入计划和结果存入 MySQL，并按管理员账号隔离。消息中只存附件元数据；删除未发送附件会清理文件，删除聊天会清理不再被聊天引用的文件。接口仅允许 `SUPER_ADMIN`，备份需包含新增文件表和导入计划表。

## 接口

以下使用默认后台前缀，实际由 `ADMIN_PATH_PREFIX` 替换。请求使用后台 Bearer 认证，JSON 响应沿用 `{code, message, data}`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/admin/v1/agent/chat/files` | multipart 字段 `file`，返回 `id/name/size/entryCount` |
| GET | `/api/admin/v1/agent/chat/files/{id}` | 文件清单、文字预览与提取警告 |
| GET | `/api/admin/v1/agent/chat/files/{id}/download` | 下载当前管理员的原文件 |
| DELETE | `/api/admin/v1/agent/chat/files/{id}` | 删除未引用附件，已引用返回 409 |
| POST | `/api/admin/v1/agent/chat/imports/preview` | AI 分析并保存可审核的导入计划 |
| GET | `/api/admin/v1/agent/chat/imports/{id}` | 当前管理员的导入方案与已导入结果 |
| POST | `/api/admin/v1/agent/chat/imports/{id}/commit` | 提交审核后的题目与配对，返回新题目 ID |

原有聊天保存和流式对话接口的用户消息新增 `files` 数组，例如：

```json
{"role":"user","content":"请整理 ZIP 里的题目","files":[{"id":"上传返回的文件 ID"}]}
```

AI 预览请求：

```json
{
  "fileIds": ["上传返回的文件 ID"],
  "useAi": true,
  "instructions": "文件比较乱，请按题面内容分组，并配对输入与参考答案。"
}
```

响应包含 `id/files/candidates/warnings/imported`。候选题目包含 `key/basic/testCases/caseOptions/sources/warnings`；测试点引用格式为 `{fileId,path}`。提交请求为 `{selections:[{key,basic,testCases}],folderId}`，其中 `folderId` 可省略。`basic` 复用原有题目草稿字段，参见 [题目与测试点上传接口](problem-upload-api.md)。前端始终启用 AI；`useAi:false` 仅供重复验证时使用确定性解析路径。

服务端调用当前配置的模型，使用原生 Function Calling 传递工具定义、工具调用和 Observation。工具只有四类：`list_files`、`read_file`、`prepare_import`、`commit_import`。每次工具执行后的结果或错误作为 `ToolResponseMessage` 返回模型，由它决定下一步；不是固定顺序调用，也不会在工具内再次调用模型。实现参考 [Spring AI 官方工具调用说明](https://docs.spring.io/spring-ai/reference/api/tools.html)。不依赖服务商 Files API，也不要求服务商访问本地私有下载地址。

`/agent/chat/stream` 新增可选 `approvedImport:{planId,request:{selections,folderId}}`。仅在用户点击审核确认时发送；工具只提供 `planId`，后端使用请求中的审核快照提交，模型无权替换快照。未提供确认、计划不匹配、账号不匹配都会拒绝操作。SSE 新增 `tool` 事件，字段 `phase/name/callId/success`，Action 带 `arguments`，Observation 带 `result`；原有 `delta/done/error` 协议兼容。

任务限制为 12 个模型操作回合，另有一个禁止工具的收尾回合，最多 24 次工具调用、150 秒和 120,000 字符的累计 Observation。执行前发送事件以检测客户端断开；同一任务中操作串行执行，不展示模型内部思维链。失败边界与验收见 [ReAct 失败场景](admin-ai-react-failure-cases.md)。

## 部署与验证

后端新增 PDFBox 依赖及 Flyway 迁移 `V93__admin_ai_chat_files.sql`（`admin_ai_chat_files`、`admin_ai_chat_imports`）。部署需更新前后端构建，后端启动时自动迁移；沿用当前 AI 服务配置，无新增密钥或环境变量。

运行前启动本地 MySQL、Redis、后端，准备生产前端构建：

```sh
npm run build
QOJ_E2E_NGINX=1 QOJ_E2E_LIVE_FILES=1 QOJ_E2E_LIVE_REACT=1 node tools/e2e/admin-ai-stream.mjs
node tools/e2e/admin-ai-history.mjs
```

`QOJ_E2E_NGINX=1` 使用缓存的 `qoj-frontend:latest` 镜像与仓库 Nginx 配置；省略则使用 Node 代理。`QOJ_E2E_LIVE_FILES=1` 会调用当前配置的真实 AI，省略则以确定性解析验证手动文件导入与浏览器流程。`QOJ_E2E_LIVE_REACT=1` 验证真实原生工具循环、人工审核、执行结果与历史恢复；另设 `QOJ_E2E_REACT_ONLY=1` 可只运行这两条 Agent 流程。

可重复产物保存在 `output/admin-ai-stream-e2e/`：`report.json`、文件素材、预览与成功截图、`file-import-verification.json`，真实 AI 模式还生成 `live-ai-file-plan.json`。ReAct 模式生成 `react-analysis-events.json`、`react-execution-events.json`、`react-review.png` 与 `react-success.png`，记录实际 Action、Observation 和最终结束事件。覆盖多题 ZIP、非标准文件名、文档提取、超过 60,000 字符的原始文本数据保留、失败回滚、重复提交、账号隔离，以及原有图片、表格和流式结束行为；结束后清理临时账号、聊天附件与测试题目。
