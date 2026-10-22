# 后台聊天 Agent 工具契约

## 执行与校验

所有工具调用先严格解析单个 JSON 对象，再按工具声明的 JSON Schema 校验，之后进入原有管理员权限、操作确认、账号归属和业务状态校验，最后执行。

解析器拒绝重复键、尾随 JSON、非对象参数和超过 100000 字符的参数。Schema 校验覆盖类型、必填字段、范围、枚举、嵌套结构和组合约束。执行循环和直接工具回调均校验，避免绕过确认入口后漏校验。

采用 [NetworkNT JSON Schema Validator](https://github.com/networknt/json-schema-validator/tree/1.5.9) 的 Draft 2020-12 实现，复用现有 Jackson 和 Caffeine，不自行实现 Schema 引擎。Caffeine 缓存的是已编译的 Schema，不是业务查询结果。

集中声明位于 `backend/src/main/resources/agent/tool-schemas.json`：

- `query_qoj`：problem、test_cases、contest、contest_problems、announcement 必须携带正整数 id；page >= 1，pageSize 为 1–50。
- `run_code`：language 枚举与 go-judge 支持的 C/C++/Java/Python 标识及别名一致；拒绝空白代码和超过 65536 字符的代码。业务层继续检查 64 KB 字节限制。
- `generate_test_cases`：inputs 和 generatorCode 必须二选一；generatorLanguage 依赖 generatorCode。输入 1–200 份，样例最多 20 份。
- 草稿工具拆为 create_draft、update_draft、get_draft、commit_draft；后三者必须携带 draftId。
- basic 展开全部现有 DTO 字段，包括样例、权限范围和通信题配置。basic 仍是完整替换，未提供的顶层 basic/testCases 部分保持原值。保存时仍强制未发布。
- generationId 与 testCases 不得同时提交；原文测试点和样例允许空字符串，测试答案允许 null，以保留特殊判题语义。

不合法参数不会触发写操作确认。校验错误提供 error.field、message，以及最多 20 条 violations。

## 缓存和幂等

查询工具每次执行，不缓存业务查询；同参数查询在写操作之后也会重新读取。只有本次对话固定附件的 read_file/read_files 结果按参数缓存，沿用任务有效期。旧检查点的参数缓存不会用于新逻辑。

写操作以任务 executionId + 模型工具 callId 形成 requestId；参数仅用于核对同一 ID 是否被错误复用，不作为去重依据：

1. 执行前先将调用 ID、参数指纹和“执行中”状态写入原有 Redis 检查点。
2. 成功或失败后记录结果，再随观察结果持久化。
3. 断点恢复遇到已完成的相同调用，返回记录的结果，不重复执行业务函数。
4. 同一调用 ID 携带不同参数，返回 IDEMPOTENCY_CONFLICT。
5. 执行已经开始、却没有确认完成的调用，返回 OUTCOME_UNKNOWN，要求先查询实际业务状态。
6. 两次参数相同但调用 ID 不同的创建，分别执行。

继续沿用原有账号隔离、任务锁和检查点 6 小时有效期。这是任务内的断点恢复防重，不是跨任务的数据库事务或全局 exactly-once 保证。Redis 检查点丢失或过期之后不能重放记录；业务函数自身的事务约束仍然生效。遇到部分成功或中断，不自动推断事务已经回滚。

## 返回结构

成功：`{ "ok": true, "data": {}, "warnings": [], "requestId": "..." }`

失败：`{ "ok": false, "error": { "code": "INVALID_ARGUMENT", "field": "limit", "message": "limit 必须小于等于 12000", "violations": [] }, "warnings": [], "requestId": "..." }`

ok 表示工具调用完成，不证明算法正确。run_code 的 data 包含原始 execution、executionSucceeded、compilationStatus、sampleValidation、algorithmCorrectness、saved。Python 标为不适用编译；无法判断是否编译完成的系统错误标为 UNKNOWN。

generate_test_cases 返回实际 testCaseCount、已校验样例数量、sampleValidation、标程及生成器执行状态；明确 saved=false、temporaryGenerationStored=true，表示只存储临时生成批次，尚未写入题目。样例按现有空白分词规则核对；未证明算法正确、覆盖率或特殊判题/通信题协议，均通过 warnings 说明。commit_draft 和 save_problem_tests 的成功结果明确 saved=true。

前端继续使用现有 SSE 事件；工具观察结果改为统一结构，commit_import 的前端读取已经对应改为 result.data。历史 manage_draft 不再提供给模型；旧的待执行调用会返回工具不可用，模型需按新工具重新规划，不能绕过新校验直接执行。

## 验证与重现

实现前记录失效场景并编写 `AgentToolContractTest`，覆盖无效参数、条件约束、同参数查询重新执行、不同 ID 分别写入、同 ID 断点重放、ID 参数冲突、无效写请求不产生审批，以及副作用后中断的恢复。

```sh
cd backend
mvn test
mvn package
cd ..
npm run build
```

报告：`backend/target/surefire-reports/TEST-com.qoj.module.agent.service.AgentToolContractTest.xml`。该测试使用真实编排循环、Schema 引擎、检查点 JSON 序列化和计数业务回调，仅模型返回由固定响应替代；没有调用真实模型、数据库或 go-judge，不能作为生产端到端或算法正确性的验证。

## 聊天回复长度

后台聊天 Agent 默认完整展开复杂任务的结论、依据、实际结果、验证与剩余事项；简单问题和用户明确要求简短的情况仍按需回答，不设置最低字数。

单次模型调用显式设置 `max_tokens=65536`，同时覆盖工具调用参数和最终回复。这个值是预算上限，不保证每次生成这么多 token，也不会扩大模型上下文窗口。[当前 DeepSeek API 文档](https://api-docs.deepseek.com/api/create-chat-completion/)支持该值；切换到其他服务时，应核实其模型输出上限及 `max_tokens` 兼容性。服务商预算可能包含推理 token，不能等同于可见正文字符数。

模型以 `finish_reason=length` 结束普通回复时，会向用户显示输出达到上限的提示；用户可发送“继续”补充剩余内容。未自动追加模型请求。`AgentReplyBudgetTest` 在实现前编写，用固定模型响应验证发送预算及截断提示；没有通过真实服务评估回复篇幅。此次 `mvn package` 共 183 项测试通过，无跳过。

## 工具发现简化

首次请求携带全部 11 个分类的简短职责摘要，以及唯一发现工具 `load_tools`。默认按分类一次加载完整业务工具，可选 `group` 缩小加载范围；完整业务 Schema 通过下一轮请求的原生 `tools` 字段发送。加载结果只返回分类、已启用组、工具名和 API 模块提示，避免重复发送 Schema。

原顺序：查询分类 → 查看工具组 → 启用工具组 → 执行业务 → 回复。
新顺序：加载分类工具 → 执行业务 → 回复。

在单分类、单业务调用且顺序执行的情况下，模型请求由 5 次降至 3 次；这是调用路径对比，未测量真实模型延迟或 Token 消耗。多步骤业务、补充参数和审批恢复仍可能增加请求次数。工具加载不申请写操作确认；真实业务写操作仍经过原有确认与权限检查。

删除 `categoriesListed`、`openedCategories` 和三个旧发现回调。保留 `enabledGroups` 作为检查点中的已加载范围；反序列化忽略旧发现字段，旧任务恢复后仅加载原来已启用的组。旧的待执行发现调用不再执行，返回工具不可用和 `load_tools` 指引，模型按新流程重新规划。前端保留旧进度名称供历史记录显示。

实现前失效场景见 `docs/agent-tool-discovery-failure-cases.md`；预先编写的 `AgentToolDiscoveryTest` 覆盖首次工具集合、分类摘要、真实 Schema、重复加载、错误参数、管理员检查、审批分类、可选组和新旧检查点恢复。运行 `cd backend && mvn -Dtest=AgentToolDiscoveryTest test` 可重复验证，报告为 `backend/target/surefire-reports/TEST-com.qoj.module.agent.service.AgentToolDiscoveryTest.xml`。这些是隔离回归验证，未进行真实供应商与数据库端到端验证。

本次验证结果：修改前 `mvn test` 183 项通过；修改后 `mvn package` 实际运行 189 项通过（本次新增 3 项，失败/错误/跳过均为 0），后端 JAR 已重建。前端 `tsc -b` 通过；仅修改进度标签，未重新生成前端发布包。未调用真实模型或改动正在运行的服务。
