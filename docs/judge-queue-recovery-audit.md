# 判题并发与失败恢复修复（2026-10-25）

## 结论与依据

附件中的并发 SE 是待核查的历史线上现象。现有源码已经有原子 UPDATE 领取、每次尝试独立 workerId、心跳、崩溃回收和事务锁定结果，不能从零测试点 SE 直接推断“领取非原子”。未访问或修改公网目标，线上确切异常栈尚未获取。

本次确认并修复两个源码缺口：

1. go-judge 服务不可用或基础设施错误直接落终态 SE，没有自动重试。现在对已构造的评测任务返回 SE/FAILED，以及处理异常，先尝试按 1/2/4 秒退避自动回队，最多重试 3 次。缺少题目/隐藏测试点仍直接报配置错误，普通 CE/WA/TLE/RE 不走系统故障重试；持续故障最终保留明确 SE，不无限循环。确定性系统配置错误也可能消耗有限重试额度。
2. callback 已提交结果后，统计等后处理失败会进入 failDirectly；旧 SQL 仅校验 worker，可能把 AC/WA 改成 SE。现在失败与回队只允许当前拥有者修改 JUDGING/COMPILING/RUNNING，已提交终态不可覆盖。

另收紧 finally 释放 worker 的条件：仍在执行中的失败任务保留租约，避免数据库操作异常后留下 workerId 为空、无法被租约回收的 JUDGING。自动回队成功会主动清除所有权；正常终态才在 finally 释放。

## 数据与兼容

新增 Flyway `V110__judge_retry_backoff.sql`，为 submissions 增加可空 `judge_retry_after`。不改现有数据和 API。

等待队列查询跳过尚未到期的重试；原子领取同时复核时间并清空字段，防止多实例持有的旧查询快照提前领取。更新重试和失败均校验 workerId、活动状态；旧 worker 不会覆盖新尝试。租约崩溃恢复与执行故障共用 retry_count 的既有 3 次上限。

## 可重复验证

修复前失败场景清单见 `docs/judge-queue-failure-cases.md`。未新增单元测试。

```sh
mvn -q -f backend/pom.xml test
python3 tools/verify-judge-security-http.py
python3 tools/verify-sandbox-isolation.py
```

后端现有 189 项测试通过。

受控 worker 故障注入（真实 HTTP、隔离数据库）：14 项检查，包括原有总执行预算/响应体超时/心跳/回收等回归，新增：

- 编译 HTTP 503 一次后，原提交自动重试并最终 AC，1 条完整测试点，retry_count=1。
- 执行 HTTP 503 一次后，同样自动恢复 AC。
- 持续 HTTP 503：总计 4 次执行尝试（初次加 3 次重试），最终 SE；记录实际退避时间。
- 用户编译错误：一次尝试完成 CE，不重试。
- 用隔离库 MySQL trigger 注入 callback 提交后的题目统计更新失败，确认原提交仍为 AC、测试点仍完整且未重试。

真实加固 worker + 业务 API：18 项检查（原有隔离检查及新增并发场景）。同用户和跨用户分别以 Barrier 对齐 3 个 HTTP 提交，6 个请求全部接受，逐个核对 AC/WA 与测试点行，没有 SE、没有结果互换。并发规模为 3，属于本报告触发规模回归，不代表大型负载容量认证。

报告：

- `.runtime/security-remediation/judge-http-report.json`
- `.runtime/security-remediation/sandbox-isolation-report.json`（含接受数量、submissionId、预期/实际终态、测试点数量）

脚本使用临时后端、临时数据库与本地 worker；结束后删除临时资源。受控故障脚本使用模拟 worker，不能当成真实语言执行证据；真实沙箱脚本补充实际执行和并发证据。

## 发布与未验证项

原有本地 18080 后端和生产均未重启/替换，未将 V110 应用于原有业务库；本次迁移在隔离验证库自动执行成功。上线需备份数据库，随后端部署执行 Flyway 迁移并重启。新增字段为可空加法迁移，回滚应用可保留字段。

未自动重判历史 SE，因为无法仅凭状态识别真实配置错误和历史环境故障；应结合 error_message/服务端日志筛选后再重判。未将线上并发 SE 根因定为本次两个缺口，也未进行大规模压测或数据库整库离线恢复测试。
