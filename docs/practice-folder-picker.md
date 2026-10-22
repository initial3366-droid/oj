# 后台题单：文件夹选题

适用页面：后台 `/practices/new` 与 `/practices/{id}/edit`。

## 行为

- 文件夹下拉框可按名称搜索，显示当前账号可访问的题目数量。
- 题目查询使用服务端分页；关键词输入防抖 300ms，支持 ID 精确匹配、标题和标签，保留原有题面搜索能力。
- 文件夹、关键词与分页共同构成查询条件；文件夹或关键词变更回到第一页。旧请求响应不会覆盖新的结果。
- 已选题目单独保存 ID 顺序及详情，跨文件夹、搜索和翻页保留；禁止重复添加，右侧支持移除与清空。
- 编辑题单通过单独详情接口回显，消除原先题单列表前 200 条、题目列表前 500 条的限制。
- 文件夹和题目请求失败分别提供重试入口，保留已选内容。

## 接口

- `GET /api/admin/v1/problem-folders/options`：返回 `id/name/problemCount`，不返回题目明细或测试点信息。
- `GET /api/admin/v1/problems?folderId=…&keyword=…&page=…&pageSize=…`：复用分页接口，新增关键词 ID/标签匹配和文件夹访问校验。
- `GET /api/admin/v1/practices/{id}`：校验题单访问权限、软删除状态后返回详情。
- 保存沿用已有创建/更新接口及题目权限校验，无数据库迁移。

## 验证与复现

- `npm run build` 通过（现有 bundle 大小提示）。
- `cd backend && mvn test -q` 通过：189 项测试，无失败、无跳过。
- 浏览器 UI 流程验证：11 项场景通过，使用真实 React 页面及受控 API 测试数据；尚未对运行中的 Spring Boot、数据库和生产账号完成联调。

复现浏览器验证：

```sh
npm install --prefix /tmp/qoj-practice-browser playwright --no-audit --no-fund
npm run dev -- --port 5173
# 在另一终端执行；按本机安装修改浏览器路径与后台前缀。
PLAYWRIGHT_MODULE=/tmp/qoj-practice-browser/node_modules/playwright/index.mjs \
CHROMIUM_PATH='/path/to/chrome' \
PICKER_ADMIN_PREFIX=auth_ac \
node tools/verify-practice-folder-picker.mjs
```

验证脚本拦截 API 请求并使用 520 道题目的固定数据，不会保存真实题单。

产物：

- `.runtime/practice-picker/report.json`：检查清单和请求记录。
- `.runtime/practice-picker/trace.zip`：Playwright 操作轨迹，可通过 `playwright show-trace` 查看。
- `.runtime/practice-picker/create-folder-search.png`：创建页截图。
- `.runtime/practice-picker/edit-folder-search.png`：编辑页截图。
