# QOJ 后台 Agent 工具目录

首次请求在系统提示词中提供分类名称和职责摘要，`tools` 只提供 `load_tools`。模型调用 `load_tools({"category":"problems"})` 后，下一轮请求直接携带该分类业务工具的完整 JSON Schema；可选 `group` 仅加载指定组。重复加载不重复添加工具；续跑恢复已启用的组，兼容旧检查点中的启用范围。所有业务工具沿用账号权限、任务限制与服务层校验。

## 专用工具

| 一级分类 | 二级组 | 工具及能力 |
| --- | --- | --- |
| files | read / import | `list_files`、`read_file`、`read_files`；`prepare_import`、`commit_import` |
| qoj | query | `query_qoj`：概况、题库、比赛、提交、公告、练习模板 |
| problems | draft / edit / test_cases / folders | `create_draft`、`update_draft`、`get_draft`、`commit_draft`、`edit_problem`、`save_problem_tests`、`manage_problem_tests`、`manage_folder` |
| contests | manage / registration_rank / publication | `manage_contest`、`read_contest_operations`、`manage_contest_operations`、`publish_final_scoreboard` |
| courses | query | `read_course_operations`：分页课程列表、详情、课程题单、学习报告 |
| courses | manage | `manage_course`：创建、补丁编辑、归档，多班级关联 |
| courses | practices | `read_practice_operations`、`publish_practice`、`update_practice_publication` |
| content | announcements / practices / publication | `manage_announcement`、`manage_practice`、`read_practice_operations`、`copy_practice`、`publish_practice`、`update_practice_publication` |
| submissions | query / judge | `read_submission_operations`、`manage_submission_operations` |
| people | query / manage | `read_people_operations`、`manage_people_operations`：用户、班级、教师、团队、专业 |
| site | maintenance | `set_maintenance_mode` |
| compute | run / generate | `run_code`、`generate_test_cases` |

## 真实业务 API 工具组

以下组复用 `list_admin_apis`、`describe_admin_api`、`read_admin_api`、`write_admin_api`，避免重复维护接口契约。每个组返回 `apiModules`，提示需要查找的实际模块。查询组不提供写入工具。

| 分类 / 组 | 模块与能力 |
| --- | --- |
| problems / solutions | `problems`：题解树查询、保存与生成 |
| people / batch | `users`：学生批量分班、移出班级、重置 AI 配额、删除；`students`：附件导入；`classes`、`agent`：相关班级与配额管理 |
| site / query | `home`、`settings`、`submission-queue`：首页、配置、判题状态 |
| site / manage | `home`、`settings`：轮播与站点设置 |
| admin_api / directory、read、write | 发现全部可用后台业务接口，查看参数，查询/导出或经确认写入 |

接口从当前 Spring MVC 路由生成，支持自定义后台前缀。目录可用中文模块关键词搜索，如“课程”“题解”“学生”。实际路由和参数以运行时 `list_admin_apis`、`describe_admin_api` 为准，不维护容易过期的固定接口数量。

## 课程与题单

- `manage_course create` 默认 `DRAFT`，需标题，可设描述、学期及 `classIds`。创建或编辑为 `ACTIVE` 和 `ARCHIVED` 时必须关联至少一个班级。
- `update` 是字段补丁，保留未传的标题、描述、学期、班级和状态。`classIds=[]` 表示明确清空班级，仅草稿允许。班级变更同步课程题单访问范围。
- `archive` 仅归档课程，保留题单、提交及学习历史。创建、编辑和归档均需确认。
- 练习模板通过 `manage_practice` 维护；面向学生的课程题单通过 `publish_practice` 创建。
- 发布必须指定进行中的 `courseId`、`studentAccessMode=SELECTED_CLASSES`、`startTime`、`endTime`、`problems`。截止必须晚于开始，题目 `visibility` 为 `VISIBLE/HIDDEN`，至少一道可见题。班级省略时继承课程全部班级，可设 `displayOrder`。
- 更新发布实例先读取详情，保留归属和起止时间并提交完整数据。发布列表支持课程/模板筛选，分页返回 `total/list`，每页最多 50 条。
- 比赛工具支持 `allowedIpRanges`，使用 IPv4/IPv6 CIDR 网段，多行配置；默认不限制，空字符串解除限制。

## 清理与确认

移除重复的 `read_site_operations`、`manage_site_operations`，由实际站点接口替代，维护模式保留独立工具。旧 XCPCIO 配置和同步接口不再进入 Agent 目录；可用的 CLICS 导出继续由实际目录提供。后台登录、令牌、密码修改、内部聊天/审批/历史/附件传输不可调用；服务密钥不可读写。

专用工具修改、删除、重判、发布等操作由系统在聊天底部逐项确认；课程写入和全部通用 API 写入也需要确认。选择“否”或自定义回复不执行原操作；刷新后可恢复待确认状态，确认绑定账号、聊天消息与具体调用。

通用网关规则见 [admin-agent-gateway.md](admin-agent-gateway.md)。更新失败场景见 [admin-agent-tools-failure-cases.md](admin-agent-tools-failure-cases.md)。运行 `node tools/e2e/admin-agent-api.mjs`，可重复核验报告、工具轨迹、接口契约、截图与导出文件保存至 `output/admin-agent-api-e2e/`。
