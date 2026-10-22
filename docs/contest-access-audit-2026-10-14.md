# 比赛访问修复与验证（2026-10-14）

## 访问规则

- 普通用户必须有 APPROVED 报名，才能查看比赛题面、内部榜单、独立排名和榜单快照。未报名、待审核、拒绝报名均无权访问；比赛公开、无密码或已结束都不能绕过此要求。
- 前台未报名时只显示比赛介绍，赛后同样适用。详情接口不返回未授权题目列表。
- 已报名用户仍受比赛开始时间、结束后允许查看题目等开关限制。
- 比赛创建者、超级管理员保留原有管理权限。显式开启的公开外榜保留公开用途，并继续受比赛网段限制。
- 提交接口要求 APPROVED 报名；聊天已有同样校验。

## 网段与可信代理

默认仅使用 HTTP 连接的来源地址，不信任客户端发送的 X-Real-IP、X-Forwarded-For。

通过反向代理部署时，在后端环境变量 `TRUSTED_PROXY_RANGES` 中显式配置代理的 CIDR 网段，例如同机 Nginx 使用 `127.0.0.0/8`。多个网段用逗号分隔，可包含 IPv6。空值表示不信任任何代理。配置无效会阻止启动。

只有连接来源落在可信代理网段中时才读取 X-Real-IP；缺失或无效的代理地址在比赛网段检查中拒绝访问。代理必须覆盖该请求头（仓库 Nginx 配置已使用 `$remote_addr`），后端端口应仅向代理开放；不要将任意客户端所在网段配置为可信代理。

比赛的 allowedIpRanges 为空时不限制；配置后检查 IPv4/IPv6 CIDR。创建者、超级管理员按原策略豁免。

## 可重复验证

- `cd backend && mvn test`：修改前基线、修改后 189 项现有测试通过。现有封榜测试仅补齐登录参赛者与 APPROVED 报名夹具，未新增单元测试。
- `npm run build`、`npm run verify:template`：通过。
- `node tools/verify-contest-detail-tabs.mjs`：浏览器验证未报名用户在赛中、赛后、密码赛均只能选介绍；保留已报名用户的表格和各 Tab。报告、截图、trace 位于 `.runtime/contest-detail-tabs/`。
- `python3 tools/verify-contest-access-http.py`：对本机真实后端执行 21 项 HTTP 检查，包括匿名/未报名/待审核/已报名、赛后开关、排名/快照、公开外榜和伪造 IP。临时克隆比赛，在 finally 中删除测试数据，不修改原比赛。
- 在端口 18081 以 `SERVER_PORT=18081 TRUSTED_PROXY_RANGES=127.0.0.0/8 mvn spring-boot:run` 启动临时后端，再执行 `QOJ_SMOKE_PORT=18081 QOJ_TRUSTED_PROXY_TEST=1 python3 tools/verify-contest-access-http.py` 验证显式可信代理分支。
- HTTP 结果位于 `.runtime/contest-access-fix/http-direct.json` 和 `http-trusted-proxy.json`，不保存令牌或密码。

HTTP 检查依赖本地 qoj-mysql 容器、已有比赛题目和 NORMAL 状态学生。它读取本地 JWT 配置在内存生成短期测试令牌，仅用于本机开发环境。
