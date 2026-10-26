# QOJ 项目架构与开发规范

## 主要项目架构

- 技术栈：Vue 3 + TypeScript + Vite 前端，Spring Boot 后端，MySQL、Redis 与 go-judge 判题沙箱。
- 前端入口为 `src/main.ts`，应用装配位于 `src/vue/main.ts`。公开端、管理端、教师端及共享页面统一由 Vue Router 管理，所有 UI 代码放在 `src/vue/`。
- 管理界面共享 `src/vue/layouts/components/ManagementShell.vue`，复用 `vendor/vue3-element-admin` 上游模板；QOJ 适配层位于 `src/vue/template-adapter`。
- API 封装位于 `src/api`；框架无关的工具保留在现有模块中。共享样式与设计变量位于 `src/styles/`，公开页面仍使用 `src/pages`、`src/layouts` 下的已有 CSS。静态资源位于 `public/`，前端构建产物位于 `dist/`。
- 后端代码位于 `backend/src/main/java/com/qoj`，按 `contest`、`problem`、`submission`、`judge` 等业务模块组织；资源位于 `backend/src/main/resources`，Flyway 迁移位于其 `db/migration/` 子目录，测试位于 `backend/src/test/java`。
- 独立 Agent Java 模块位于 `agent-java/`。判题沙箱配置位于 `docker/go-judge/`，仅支持 C、C++、Java、Python。
- 项目文档位于 `docs/`；部署包、备份与构建产物不作为业务源码维护。

## 开发规范

### 前端

- 新增或迁移页面使用 Vue 3 单文件组件与 `<script setup lang="ts">`，统一使用 Vue Router、Pinia、Element Plus 和 `@element-plus/icons-vue`；禁止引入 React、第二套前端运行时或 Semi UI。
- 直接复用 `vendor/vue3-element-admin` 中的上游 UI，不重新实现或改造已有等价模板组件的样式。保留上游模板、样式、图标和资源；接口与业务差异在 QOJ 适配层处理。
- 不可避免的上游脚本适配必须记录在 `vendor/vue3-element-admin.upstream.json`，并通过 `npm run verify:template` 完整性校验。
- 保持现有 API 契约与路由行为；共享工具尽量不依赖 UI 框架。
- TypeScript、CSS 使用 2 空格缩进。优先使用 `src/styles/tokens.css` 中的 `--qoj-*` 变量，禁止恢复 `--semi-*` 变量。

### 后端与 Java

- 包结构采用 `com.qoj.module.<feature>`，按职责划分 `controller`、`service`、`entity`、`mapper`、`dto`、`vo`。
- 后端及 `agent-java` 遵循《阿里巴巴 Java 开发手册（黄山版）》：UTF-8、LF、4 空格缩进、禁止 Tab，单行不超过 120 字符；续行缩进 4 空格。
- 类名使用 UpperCamelCase，方法与变量使用 lowerCamelCase，常量使用 UPPER_SNAKE_CASE；命名表达业务含义，避免晦涩缩写和嵌套三元表达式。
- 左花括号与声明或控制语句同行，非空语句体另起行；所有条件和循环语句必须使用花括号，每行只写一条语句。
- 展开异常处理与 lambda 语句块；操作符两侧、逗号后、控制关键字与左括号之间保留空格，不做空格对齐。
- 方法与独立逻辑步骤之间保留一个空行；使用显式导入，避免通配符导入及不必要的全限定名。
- 使用 Javadoc 说明类与方法契约；注释解释业务约束、安全边界和非显然决策。行内说明放在相关语句上方，`//` 后保留一个空格，不编造作者或日期。
- 仅做格式调整时，保持 API 与工具名称、提示词、参数默认值、执行顺序、权限、审批分组、幂等、超时和异常行为不变。
- Agent 服务文件使用 `tools/java-style/` 中的 Alibaba P3C 格式配置，执行 `formatter:format` 后通过 `formatter:validate`。

### 验证与交付

- 优先使用 E2E 验证复杂功能，保留可重复执行的报告、截图或 trace；不得在实现代码后补写单元测试，不为 Vue 迁移新增单元测试。
- 必须隔离测试时，先列出可能失败的情况，再编写实现。现有后端测试使用 Spring Boot Test/JUnit，测试类命名为 `*Test.java` 并放在对应测试包下。
- 前端变更通过构建中的 TypeScript/Vue 类型检查；后端变更前运行现有测试，变更后完成相关验证。
- 提交保持聚焦，使用简洁的祈使式说明；生成产物与源码变更分开。PR 说明问题、改动与验证结果，UI 变更附截图，并注明数据库迁移、环境变量和安全相关变化。

### 数据与安全

- 不提交真实密钥或凭据；本地配置使用 `.env`，生产配置通过部署环境管理。
- 数据库结构变更必须新增 Flyway 迁移，不修改已应用的历史迁移。
- 生产环境禁止启用 `ENABLE_UNSAFE_LOCAL_JUDGE`。
- 不重新引入 C#、`csharp`/`cs` 或 `mono`/`mcs` 判题支持。
