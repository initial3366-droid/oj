# 比赛巡查 Agent 工具：实施前失败场景

- 比赛分类未列出巡查工具，启用巡查组后工具不可调用。
- 缺失或无效 contestId 查询了全站统计，或者不存在的比赛被报告为正常。
- 非后台用户或无比赛管理权限的用户读取了异常提交。
- 通过数量按 AC 提交次数累计，未按选手与比赛题目去重。
- SE / FAILED 被遗漏，或者 WA / RE 被误报为系统失败。
- 错误记录不分页，响应超过工具输出限制。
- 排队提示被误报为判题服务已故障；下游查询失败被当作零异常。
- Agent 读取巡查时修改提交或自动执行重判。
- 打包包含旧后端、旧前端，或缺失 Agent 工具实现。

验证使用已有真实聊天 E2E 的脚本模型、后台服务和数据库；保留工具结果 JSON、截图及可复现命令。打包后验证可执行 JAR、前端文件与 SHA256 校验。

## 调用方式

依次调用 `list_tool_categories`、`list_tool_groups(category="contests")`、`enable_tool_group(category="contests", group="inspection")`，然后调用 `read_contest_inspection`。

参数：`contestId` 必填；`page` 默认 1；`pageSize` 默认 5，范围 1～10。SE 与 FAILED 独立分页，响应包含各自 total/list；系统失败总数包含所有页。`acceptedCount` 与比赛概览口径一致。

示例：`{"contestId":123,"page":1,"pageSize":5}`。工具仅查询，异常处置需另行使用提交管理工具及其现有确认流程。
