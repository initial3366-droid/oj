# V105 迁移缺失导致启动失败

修复前确认的失败情形：

- 数据库已执行 V105，但新 JAR 未包含该脚本，Flyway 报 `Detected applied migration not resolved locally: 105`，阻止 Java 启动。
- 重新创建内容不同的 V105，导致已执行迁移的 checksum mismatch；必须从旧发布 JAR 原样恢复。
- 通过关闭校验、忽略迁移、repair 或删除历史记录掩盖缺失，破坏迁移记录与实际结构的一致性。
- 增量构建残留旧资源，使开发机正常但全新构建仍缺失迁移；必须检查 clean 构建后的 JAR 内容。
- 老库从 V105 升级到 V107 失败、重复启动失败，或新库不能完成全部迁移。
- 回归验证误用现有业务数据库或 Redis；使用专用临时数据库、独立临时 Redis，只清理本次创建的资源。

原文件保留在 `release/qoj-native-20261010-081438/backend/qoj-backend.jar` 和 `release/qoj-native-20261010-091520/backend/qoj-backend.jar`，两个文件中的 V105 内容一致，SHA256 为 `062a9db63fcd5ff32beb3956e505683b2ec21326f80088aba00d40d98d959838`。

复现：构建修复后 JAR，再运行 `node tools/e2e/flyway-v105-startup.mjs`。脚本在本地 Docker MySQL 中创建临时数据库，用旧 JAR 迁移到 V105，复现缺少 V105 的发布包启动失败，再验证修复后的升级、重启和全新安装。独立 Redis 随测试创建并移除。报告及启动日志位于 `output/flyway-v105-startup-e2e/`。
