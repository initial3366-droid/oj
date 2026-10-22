# 判题结果同步：实现前失败场景

- 同一 ID 的轮询、WebSocket 和其他详情调用重叠，造成多个并发 GET；不同 ID 被错误合并。
- GET 拒绝后，Single Flight 缓存未清理，后续无法重试；成功后错误缓存旧结果。
- 固定间隔使客户端同步请求；慢请求期间继续累积轮询。
- Pending、Running、未知或空状态被当成终态；终态缩写或完整名称未识别。
- 收到终态事件时，已在途 GET 返回旧状态；详情失败或旧状态导致提前清理。
- 获取终态详情后仍有定时器或订阅；订阅晚于清理完成而泄漏。
- 页面卸载或替换监听后，晚到的 GET / 订阅修改旧页面状态。
- 事务提交前发送消息，其他连接读取旧数据；事务回滚仍发送完成事件。
- 无事务的调用被永久延迟；状态消息延迟但队列刷新提前发生。

验证使用生产前端 API 与页面监听函数的组合场景（替换传输和计时器），以及 Spring 事务同步边界验证。
这不是运行完整服务的浏览器 E2E；完整 E2E 还需可用的数据库、判题服务和登录会话。

## 验证记录

- 实现前：前端脚本复现同 ID 重复请求；新增的事务同步验证 3 项中 2 项失败（提交前发送、回滚仍发送）。
- 实现后：`node tools/verify-judge-result-sync.mjs`，35 项检查通过；生成 `.runtime/judge-result-sync/frontend-report.json`，包含检查清单与实际随机轮询延迟。
- `npm run build` 通过，日志 `.runtime/judge-result-sync-frontend-build.log`（存在 bundle 体积提示）。
- `cd backend && mvn test -q` 通过，日志 `.runtime/judge-result-sync-backend-after.log`，JUnit 明细见 `backend/target/surefire-reports/`。
- 后端回调 `JudgeCallbackService.handleJudgeResult` 已有事务，调度器在其返回及元数据写入完成后调用消息发布器。本次额外让事务内调用的提交状态与队列刷新通知统一延迟至 `afterCommit`；回滚不推送，无事务路径保持立即发送。
- GET 的合并缓存仅保留在途 Promise，成功和失败都删除。轮询使用递归 timeout，每次随机等待 1600–2400ms；慢请求完成后才安排下一次，避免请求积压。
