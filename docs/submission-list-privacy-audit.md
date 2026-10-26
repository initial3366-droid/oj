# 提交响应最小化

2026-10-25，本地源码修复，未部署；既有发布包不包含本次改动。

GET /api/v1/submissions 使用独立 SubmissionListVO，字段从 21 个减少到 13 个：id、userId、displayName、problemId、problemTitle、language、status、timeUsed、memoryUsed、createdAt、codeLength、passedCaseCount、totalCaseCount。

列表不再返回 username、identityType、identityId、contestId、practiceId、submitTime、code、cases。userId 保留给前台用户筛选和公开身份展示；createdAt 使用原 submitTime 优先的值，保持已有页面的提交时间语义。

SubmissionVO 同步移除登录名、内部身份、比赛/题单关联及重复时间，作用于 POST 提交响应和 GET 单条详情。详情仍按既有权限返回代码和测试点结果。普通练习原有登录用户代码分享规则保留；比赛代码权限、封榜和他人成绩隐藏逻辑保留。管理员专用 API 保留管理字段，管理员访问公开 API 也只能获得精简字段。公开列表仍按原产品规则允许匿名访问。

公开数据装配查询只读取用户 id/display_name，不读取 username。显示名为空时返回“用户”，不回退到登录名。

验证：
- python3 tools/verify-submission-list-privacy-http.py：14 项真实 HTTP E2E，通过独立数据库/临时后端验证白名单、匿名/本人/管理员、空显示名、分页筛选、普通练习代码分享、匿名详情拒绝、比赛详情授权、隐藏成绩及管理 API 合同。
- mvn -o -q -f backend/pom.xml test：后端测试通过，具体计数见 .runtime/submission-privacy/verification.json。
- npm run build、npm run verify:template、git diff --check 通过。

报告：.runtime/submission-privacy/http-report.json、list-fixture.json、verification.json。脚本需要本机 qoj-mysql/qoj-redis 和空 Redis DB15，自动创建/删除临时数据库并停止临时后端，不访问生产站点。
