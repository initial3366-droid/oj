# 三端登录验证码与共享锁定核查（2026-10-25）

## 当前结论

附件描述的是历史线上行为。当前源码的 AuthController、TeacherAuthController、AdminAuthController 均在登录前无条件调用 verifyCaptcha；AuthService 的失败键已为 `来源IP + trim/lowercase用户名`，并没有使用入口参数隔离计数。本地验证不能确认公网正在运行相同版本，也不能把报告中的绕过直接当作当前源码事实。

本次增量修复：

- LoginRequest 对 captchaId/captcha 增加 @NotBlank 和长度上限（128/16），在 DTO 边界明确必填；控制器仍然调用一次性图形验证码校验。
- 移除登录锁定方法中未使用的 front/teacher/admin 参数，明确三端共享同一来源/用户名预算。
- 旧 assertLoginNotLocked 发现计数无 TTL 时会删除计数并直接放行。现在恢复 15 分钟过期时间并继续判断累计失败数，避免进程在 INCR/EXPIRE 之间中断时反而解除锁定。
- 保留跨入口共享的来源/全局频率预算，不改变前端登录请求契约或会话时长。

验证码缺失等 DTO 验证错误返回 HTTP400（统一业务码40000），已有验证码校验错误按原业务错误码返回；两者都不会进入成功登录。

## 验证

```sh
mvn -q -f backend/pom.xml test
python3 tools/verify-login-guard-http.py
```

现有后端 189 项测试通过，未新增单元测试。

34 项真实 HTTP 检查通过：

- 三端各 6 种验证码参数边界：省略、null、空字符串、仅 ID、仅验证码、伪造组合全部拒绝；使用的是正确测试账号密码，确认不是靠口令错误阻止登录。
- 三端错误验证码会消费挑战，正确验证码也只能用一次；三端正常登录均可用。
- 相同来源、相同归一化用户名，轮换三入口的 5 次口令失败累计在同一 Redis 键；后续三端即使正确口令也返回 429。
- 用户名大写和不受信任的 X-Forwarded-For 无法绕过现有锁定。
- 人工创建数值为5且无TTL的计数键，登录仍返回429，计数保持5并恢复TTL。
- 各入口在失败数4时正确登录成功，清除失败计数。

报告：`.runtime/security-remediation/login-guard-report.json`。
日志：`.runtime/security-remediation/login-guard-backend.log`。

脚本需本地 Docker MySQL/Redis、Maven、Python bcrypt，并要求 Redis DB15 为空。使用临时数据库、后端和三种测试身份，结束后停止实例、删除数据库、清理专用 Redis DB15 测试键。不向公网地址发送请求，不输出测试令牌或密码。

## 边界

未部署或验证生产运行版本，原本地18080服务未替换。此项不需要数据库迁移，需构建并重启实际后端后才生效。未进行真实用户弱口令尝试。

本次验证的是跨入口共享的来源/用户名锁定，不代表按用户名跨不同真实来源IP的全局锁定，也未将串行5次阈值验证当作高并发严格配额证明。
