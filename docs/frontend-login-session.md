# 前台登录与新标签页做题

## 登录机制

- 浏览器不保存登录密码，只保存 JWT 访问令牌与刷新令牌。
- 不勾选“记住密码”：令牌保存在 sessionStorage；服务器会话总时限为 8 小时。
- 勾选“记住密码”：令牌保存在 localStorage；服务器会话总时限为 8 小时。
- 访问令牌有效期由 JWT_ACCESS_EXPIRE 配置，默认 900 秒；当前本地 .env 配置为 7200 秒，且不超过会话剩余时长。
- 续期轮换刷新令牌，服务器通过 Redis 校验；续期不延长原始会话截止时间。
- 后台与教师端使用各自独立的令牌键。

## 本次故障与修复

比赛题目、普通题库、题单原先使用带 noopener 的新窗口打开方式。未记住登录时，sessionStorage 不会复制到此新页，导致已报名用户的新做题页丢失身份；localStorage 共享，因此勾选记住登录时正常。

统一通过 src/api/frontendSessionSync.ts 打开做题页：先打开本站空白页，复制前台临时令牌，再断开 opener 并导航。令牌不写入 URL 或 localStorage。原标签页不跳转。持久登录仍使用 noopener/noreferrer。

sessionStorage 标签页使用 BroadcastChannel 同步同一令牌家族的续期版本与退出事件。续期在 Web Locks 内先向同家族标签页核对最新版本，避免旧刷新令牌被重用。不同登录家族互不覆盖。缺少上述浏览器能力时，临时登录使用当前标签页打开题目，保证身份完整。

独立手动打开的标签页不主动获取临时登录，只有本站做题入口创建的标签页继承当前临时会话。

## 验证

执行 `node tools/verify-frontend-session-tabs.mjs`，可通过 LAYOUT_BASE_URL 指定前端地址。真实浏览器操作本站比赛题目按钮，API 使用固定数据模拟已报名及令牌轮换。

覆盖勾选/不勾选记住登录、新页题面身份、页面刷新、opener 隔离、并发续期只请求一次、退出同步、临时令牌不长期保存。报告、截图与 trace 保存在 .runtime/frontend-session-tabs/。
