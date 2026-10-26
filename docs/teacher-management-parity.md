# 教师端管理功能补齐

本次补齐此前确认的教师端功能缺口；管理员专属配置及 Polygon 权限保持现有边界。

## 实现

- 管理员、教师的提交列表、统计及判题队列共用 `SubmissionManagementPage.vue`，由各自入口明确选择认证客户端。
- 教师新增比赛提交、比赛队列、全局队列、提交统计路由及菜单。支持详情、代码、分数、测试点、耗时、内存、判题信息、CSV 导出、重判、删除；比赛队列支持日志、优先级、重判、取消及删除。
- 比赛详情开放教师答疑广播、名单粘贴/文件批量导入和比赛巡查。教师消息使用独立的 WebSocket 客户端及教师令牌刷新流程，避免与同时登录的管理员会话串用。
- 名单导入后后台刷新详情，保留导入弹窗的新增、跳过、失败明细。
- 教师提交列表可见范围包含其管理比赛的所有参赛者，继续保留原有所辖学生范围；详情及操作仍由服务端权限校验。
- 关键词（学生、题目、题单、提交 ID）和仅题单筛选在数据库分页前执行；列表与 CSV 复用筛选规则。教师 API 与管理 API 均支持 `keyword`、`practiceOnly`。
- 题单提交改为真实服务端分页，移除只取前 1000 条再前端过滤的旧路径。

## 可重复验证

```sh
npm run build
npm run verify:template
mvn -f backend/pom.xml test
QOJ_TEACHER_PARITY=1 QOJ_E2E_OUTPUT=artifacts/teacher-parity python3 tools/verify-lanqiao-contest-http.py
```

E2E 复用项目已有 Docker MySQL/Redis，创建临时数据库、随机端口 Spring 服务，并要求 Redis DB15 为空；结束后删除临时数据库和 Redis 测试数据，不修改主数据库。浏览器访问构建后的真实 Vue 页面和真实接口，无接口 mock。需要 Python bcrypt/websocket-client、Playwright 和脚本中配置的本机 Chromium（可通过环境变量覆盖路径）。

## 验证结果

- 37 项 HTTP 检查通过，含原蓝桥杯隔离性检查与新增教师权限、操作、筛选流程。
- 7 项浏览器流程通过：比赛提交入口与刷新、详情及 CSV；队列日志及优先级；1006 条题单分页筛选；名单文件导入；WebSocket 广播与回复及刷新补看；巡查；管理员提交页回归。
- 同时登录教师、管理员进行验证，教师 HTTP 请求使用教师令牌，浏览器所发两条消息在数据库中均归属于教师身份。
- 无关资源、学生及匿名管理请求被拒绝；教师可读取本人比赛中非本班学生的提交。
- 前端构建与上游模板完整性检查通过；189 项既有后端测试通过，无新增单元测试。

证据见 `artifacts/teacher-parity/verification.json`、`http-report.json`、`ui-report.json`、截图及 `teacher-management-trace.zip`。失败场景清单见 `docs/teacher-management-parity-failure-cases.md`。

本次完成代码及本地隔离验证，未部署或重启现有业务服务。
