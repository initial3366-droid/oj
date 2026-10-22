# Polygon 比赛包

资料来源：
- [Polygon 官方 API 文档](https://codeforces.github.io/polygon-misc/API)：比赛 contest.xml、题目 problem.xml，以及包含已生成测试的 Linux/Windows 包。
- [Codeforces checker/validator 描述](https://codeforces.com/blog/entry/7979?locale=en)：assets/checker/source 与 testlib checker。
- [CMS Polygon loader](https://github.com/cms-dev/cms/blob/main/cmscontrib/loaders/polygon.py)：独立实现的比赛目录、毫秒时间限制、字节内存限制交叉参考。

实现前失败场景清单（通过 HTTP / 浏览器端到端验证，不新增单元测试）：
- 比赛 ZIP 或单题 ZIP 根目录多一层，题目顺序/标签、中文题名、毫秒/字节单位识别错误。
- 缺少测试、答案或 checker 源码；只有生成脚本；错误 XML 或测试数量不符。
- ZIP 穿越、重复文件、压缩炸弹、XML 外部实体、远程题目 URL 被意外请求。
- 交互题、文件输入输出、分组依赖或不支持的计分方式被静默降级。
- 未授权用户下载隐藏数据；导入一半失败留下题目或比赛；导入误改已有比赛。
- 导出后重新导入丢失题面、测试字节、样例、checker 或题目顺序。
- 预览失败仍可导入、切换文件沿用旧预览、重复点击导入、上传失败无恢复入口。

入口：后台比赛列表“导入 Polygon”，每行“导出 Polygon”。先上传并预览，核对题目及警告，再指定比赛名称、开始时间、时长和 ACM/OI 赛制，创建新比赛。原有比赛不会被覆盖，导入题目为私有且未发布。

范围：离线 ZIP；支持 contest.xml 引用的本地题目目录及单题 problem.xml，允许外层目录。使用 tests 测试集和已生成的 UTF-8 文本输入/答案；时间为毫秒，内存字节转换为 MiB（不能无损转换时拒绝）。支持 HTML 题面、本地图片内嵌、LaTeX 文本回退和 C++ testlib checker。导入不会运行包中生成器、脚本或二进制，也不会访问 XML 中的远程 URL。ZIP 压缩最多 50MiB、解压最多 64MiB、单文件最多 16MiB、最多 20,000 文件、100 题、每题 5,000 测试。

外部图片链接保持原 URL，不自动下载，离线查看仍依赖原站。只有 LaTeX 的题面按源文本保留并显示警告，建议在 Polygon 渲染 HTML 后打包。checker 仅支持单个 C++ 源文件及内置 testlib.h；其他自定义头文件需先合并进源码。样例在 QOJ 中另行展示，正式 tests 中的所有测试（含 sample 标记）仍参与判题，避免漏测。省略测试分数时将 100 分按整数均分；显式分数必须全部提供，40.0 等整数小数形式可接受。

API（实际前缀按 ADMIN_API_PREFIX 配置）：
- `POST /api/admin/v1/contests/polygon/preview`：multipart `file`，返回不含测试内容的题目概览和警告。
- `POST /api/admin/v1/contests/polygon/import`：multipart `file` 和 JSON `settings`（title/startTime/durationMinutes/type），事务创建新比赛及其私有题目。
- `GET /api/admin/v1/contests/{id}/polygon/export`：ZIP，按比赛题目顺序导出当前原题及完整测试。上述接口限超级管理员。

无需数据库迁移或新增环境变量。默认 multipart 请求上限从 50MB 调整为 51MB，为 50MiB ZIP 的 multipart 边界及 JSON 配置保留空间；单文件限制仍为 50MB。已有自定义网关上传上限需留出同样的请求头/分段空间。

验证命令（本地 MySQL/Redis、后端 18080 和 Vite 5173 已启动）：`python3 tools/verify-polygon-contests.py`，随后 `node tools/verify-polygon-browser.mjs`。输出 `.runtime/polygon-e2e/` 内的 HTTP/浏览器报告、ZIP 和截图。测试只创建合成比赛/题目，结束后通过现有删除接口软删除；不读取或修改真实题目的隐藏测试，不调用 AI。导出再导入时逐文件检查题面、测试原始字节、checker、样例和测试分数。

不兼容的交互/通信、文件 I/O、分组计分/依赖和非整数测试分数会明确拒绝；缺失已生成数据时请从 Polygon 下载完整 Linux/Windows 包。导出是可供判题系统读取的本地 Polygon 格式包，不自动上传到 Polygon/Gym，也不伪造标程和生成器。QOJ 特有赛程/报名/账号/提交记录不属于此格式；导入需重新设置赛程。
