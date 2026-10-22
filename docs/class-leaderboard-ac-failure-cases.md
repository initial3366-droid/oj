# 班级 AC 统计修改前的失败场景

- 班级统计包含仅在比赛中通过的题，导致大于班内学生在前台个人榜单显示的 AC 数量之和。
- 同一学生同题多次 AC 被重复累计；两名学生通过同题却只算一次。
- 班级学生没有分数记录时出现异常；非学生成员被算入。
- 班级与个人榜分别读取提交表/分数表，对历史 ACCEPTED 状态或待更新分数的处理不一致。
- 修改统计后继续读取旧 Redis 缓存；每日刷新导致新 AC、转班长时间不反映。
- 重新计算后的班级榜失去排序、limit 行为，页面展示与接口值不一致。

方案：班级汇总与前台个人榜共用 user_scores.ac_count（该数据由非比赛提交重算），保留按学生分别去重后相加的口径；使用新版、短期班级缓存。用真实 MySQL/Redis/Spring API 和浏览器 E2E 验证并保留报告，不新增单元测试。

## 实现与验证结果

班级 AC 直接汇总班内 STUDENT 的 user_scores.ac_count，与前台 /leaderboard 个人榜相同；删除原本包含比赛提交的班级专用统计查询。没有分数记录的学生计 0，非学生不参与。

班级缓存使用 :v2 键以避开旧口径，TTL 为 1 分钟；到期请求重算并缓存完整榜单，再按 limit 返回，避免 limit=3 污染后续完整请求。个人榜、比赛排行榜及比赛判题未改动。

复现：先运行 `cd backend && mvn -q package`，再在根目录运行 `node tools/e2e/class-leaderboard-ac.mjs`。4 项真实后端/数据库/Redis/浏览器 E2E 和 177 项现有后端测试通过。E2E 使用独立 Redis DB 14，并仅创建、清理自己的数据库记录；Redis 过期测试以 PEXPIRE 加速，未模拟 API 响应。分数记录使用生产的非比赛 AC 重算公式构造，本测试不覆盖完整判题流程。

证据：output/class-leaderboard-ac-e2e/report.json、initial-response.json、cache.json、leaderboard.png、cleanup.json、verification.json（源码及构建 JAR SHA-256）。后台构建产物为 backend/target/qoj-backend-0.1.0.jar，尚未部署或更新 release 压缩包。
