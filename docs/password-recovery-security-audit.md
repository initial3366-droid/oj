# 密码重置与注册验证码防枚举核查（2026-10-25）

## 结论

附件描述的线上历史版本与当前源码存在差异。当前源码已有以下保护，本次在本地 HTTP 回归中验证了关键行为：

- `AuthRateLimitFilter` 已覆盖重置与注册，共享来源和全局 Redis 预算，Redis 限流失败时拒绝请求。
- `EmailVerificationCodes` 在 Redis Lua 中原子比对与消费；同一邮箱错满 5 次删除验证码，成功后立即删除。重置、注册和其他邮箱验证码消费者共用该逻辑。
- 发码前强制一次性图形验证码，并有邮箱发送间隔及每日上限。

本次增量修复：

- 注册与重置 DTO 强制邮箱验证码为 6 位 ASCII 数字。
- 注册与重置共享独立的每来源每分钟 20 次预算，替代沿用普通认证的 120 次预算。配置项为 `qoj.auth.recovery-source-limit-per-minute`，默认 20，最低按 1 执行。全局预算维持原有配置。
- 保留现有前端请求契约；防枚举依赖原子尝试次数限制、一次性消费和服务端限流，不要求用户在提交邮箱码时重复填写图形码。

## 验证

更新源码通过 `mvn -q -f backend/pom.xml test`：189 项，0 失败，0 错误，0 跳过。未添加单元测试。

在临时本地后端 `http://127.0.0.1:18081` 上执行：

```sh
QOJ_HTTP_BASE=http://127.0.0.1:18081 python3 tools/verify-security-remediation.py
QOJ_HTTP_BASE=http://127.0.0.1:18081 python3 tools/verify-recovery-guard-http.py
```

- 既有脚本 13 项 HTTP 回归通过，覆盖错满 5 次验证码失效、并发正确重置只成功一次、重置后旧令牌失效等。
- 新脚本 12 项检查通过：缺失、过短、过长、字母、全角数字均拒绝；交替调用注册与重置的第 21 次请求返回 HTTP 429，两个入口均包含 `Retry-After: 60`；伪造 `X-Forwarded-For` 无法绕过来源预算。
- 报告：`.runtime/security-remediation/http-report.json`、`.runtime/security-remediation/recovery-guard-report.json`。
- 使用临时本地账户及人工置入 Redis 的测试验证码；既有脚本删除测试账户与验证码，新脚本恢复本地来源预算。未发送真实邮件。

## 边界与发布

未部署生产，未向报告中的公网地址执行枚举，也未验证生产运行版本。本地原有 18080 服务未重启；临时 18081 验证实例在完成后停止。上线时需构建并重启实际后端，确认代理信任配置与 Redis 可用，再在受控测试账户上回归。报告中关于其他用户信息接口的关联漏洞不属于本次结论。
