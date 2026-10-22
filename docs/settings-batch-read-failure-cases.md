# 配置批量读取：实现前失败场景和验收

范围：SystemSettingService.getFrontendSettings/getJudgeRuntimeSettings，HTTP → Spring Security/MVC → Service → MyBatis → MySQL。先记录场景并编写 HTTP E2E，再修改生产代码；不添加单元测试。

- 全部键缺失：每个字段保留当前独立默认值。
- 部分键缺失：已存在值和缺省值正确混合；无关键不影响返回。
- 前端字符串：中文、换行、引号、空字符串原样返回；Boolean.parseBoolean 的既有行为不变。
- 判题布尔：空字符串回退默认值、大小写 TRUE、带空格的字符串和非法字符串保留现有语义。
- 数字：正数、0、负数、空白、非法文本、int/long 溢出；正数解析前后 trim，非正数回退默认值。
- 数据库更新后下一请求立即读到新值，禁止添加跨请求缓存。
- 读请求不修改配置行、updated_at/updated_by。
- 管理配置无登录返回 401，普通学生返回 403，超级管理员返回完整运行时配置；公开判题接口不泄露管理字段。
- SQL 计数必须发生于实际 JDBC Statement 准备日志；剔除调度线程，禁止用 Mapper mock 调用数替代。
- 优化前管理端前端配置请求 10 条配置 SELECT、管理判题请求 7 条；优化后均为 1 条。公开前端配置请求还经过维护模式拦截器，关闭维护模式时实际 20→2 条 SQL；开启时仍返回 503，maintenance-mode 入口仍可查询。响应与副作用应一致。
- 测试中途失败也关闭启动进程、删除测试自己的 Redis 容器和临时数据库；不能清空业务 Redis 或改业务配置。

运行：先 `cd backend && mvn package`；再从仓库根目录执行 `node tools/e2e/settings-batch-read.mjs before`（原实现）或 `node tools/e2e/settings-batch-read.mjs after`（新实现）。使用当前 qoj-mysql 的表结构创建独立临时 schema；不复制用户数据。测试会使用现有 qoj-redis 镜像启动自己的 Redis 容器。证据保存在 output/settings-batch-read-e2e/{before,after}/。
