# 用户详情接口隐私修复（2026-10-25）

## 确认与修复

`GET /api/v1/users/{id}` 原位于匿名 GET 白名单，PublicUserProfileVO 直接携带 username、role、createdAt；前端用户主页展示 @username 和角色。这些行为使公开展示资料与登录标识没有边界。

现改为：

- SecurityConfig 要求有效登录态；服务层同时执行 CurrentUser.required。匿名查询现有/不存在 ID 都返回401，不提供存在性差异。
- 此接口对本人、他人以及管理员统一返回精简投影：id、displayName、avatarUrl、acCount、submitCount、totalScore。
- 移除 username、role、createdAt。邮箱、学号、口令及账号状态等从未加入该响应；查询用户时也只选择展示字段及用于原有角色过滤的 role，不加载账号登录名或凭据。
- 空白展示名使用“用户”，不回退到登录名。
- 前端类型和主页同步移除登录名、角色、加入时间展示；保留展示名和训练统计。
- 本人完整资料走现有 `/api/v1/auth/me`；完整管理资料仍走现有管理员用户详情和权限体系。普通学生不能从管理接口读取他人详情。

这是对登录用户可见的展示资料投影，不是“只要登录就能看完整用户信息”。公开排行榜继续展示有限战绩信息；自增 ID 本身不作为授权依据。

## 验证

```sh
mvn -q -f backend/pom.xml test
npm run verify:template
npm run build
python3 tools/verify-user-profile-privacy-http.py
npm run preview -- --host 127.0.0.1 --port 31891 --strictPort
node tools/verify-user-profile-privacy-ui.mjs
```

- 现有后端189项测试通过，未新增单元测试。
- 模板完整性验证与前端类型检查/构建通过。
- 15项真实 HTTP 检查通过，覆盖匿名、无效令牌、本人、他人、管理员、空展示名、缺失ID、本人私有资料、管理端权限及排行榜字段。
- 登录后接口 JSON 键集合必须精确等于上述六个字段，防止新增内部字段静默泄露。
- 桌面1440与手机390宽页面验证通过，截图和trace已保存。浏览器使用真实HTTP验证保存的脱敏展示资料作为UI接口固定响应，验证构建后渲染；访问控制由前述真实后端HTTP验证证明，未把UI固定响应当作鉴权证据。

产物：

- `.runtime/security-remediation/user-profile-privacy-report.json`
- `.runtime/security-remediation/user-profile-ui-report.json`
- `.runtime/security-remediation/user-profile-1440.png`
- `.runtime/security-remediation/user-profile-390.png`
- 对应 `user-profile-*-trace.zip`

HTTP脚本使用临时后端、数据库和测试账号，要求本地MySQL/Redis、Maven、Python bcrypt以及空Redis DB15，结束后清理。UI脚本需要Playwright和Chromium，可通过 PLAYWRIGHT_MODULE、CHROMIUM_PATH、QOJ_UI_BASE 覆盖本机依赖与地址。

## 发布边界

未部署公网，未替换原有本地18080后端；不需要新数据库迁移。上线需同时更新后端与对应前端，旧客户端不能再依赖此接口的 username/role/createdAt。

附件中“注册占用枚举”未得到报告自身确认，不作为本次已确认漏洞；关联登录与重置防护已在此前独立任务核查。本次没有进行真实账号枚举或弱口令尝试。
