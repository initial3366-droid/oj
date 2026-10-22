# Frontend Vue Migration

Status: complete. Vue 3 is the only frontend runtime and owns the public, admin, and teacher route trees. The application uses Vue Router, Pinia, Element Plus, and `@element-plus/icons-vue`, following the requested `vue3-element-admin` stack.

The React entry, route bridges, TSX/JSX screens and components, React-only styles and helpers, and React packages have been removed. Shared API clients, types, Monaco, KaTeX, websocket code, and styles still used by Vue remain in `src`.

## Route coverage

- Public site: home, about, login/register, courses, problems and submissions, practices, problem solving and history, contests and scoreboards, leaderboard, public profiles, user center, and not-found.
- Admin: dashboard, teachers, majors, classes/details, teams, problems/editing/test cases/folders, courses, practices/publications/reports, contests/editing/inspection/import/messaging, students and imports, AI chat/generator/settings, submissions/statistics/queue, leaderboard, announcements, system settings, code templates, judge settings, profile, and not-found.
- Teacher: dashboard, classes, students, imports, applications, submissions/statistics, problems/editing/test cases/folders, courses, practices/publications/reports, contests/editing, profile, and not-found.

Shared workflows include the HTML/LaTeX editor with formula library and image upload, problem preview and progressive solutions, contest and roster imports, contest messaging and status notices, Monaco code editing, and AI chat attachments/import review/approval/resume. AI chat history stored by the previous browser client is imported into the server-backed session list.

## Build

```sh
npm run build
```

The build runs Vue type checking, TypeScript checking for shared modules, and the Vite production build.

## Original upstream UI integration

The full Gitee repository is vendored in `vendor/vue3-element-admin` (MIT license retained), version 4.9.0, commit `f852b22d07d220d6526a9173765e21f39160de4e`. A managed clone remains in `.runtime/vue3-element-admin-upstream`. `vendor/vue3-element-admin.upstream.json` records original SHA-256 hashes and the explicit script adaptations.

Administrator and teacher portal layouts import the actual upstream `layouts/index.vue`, including its four layout modes, sidebar, navbar, tags view, settings drawer, menu search, fullscreen, component sizing, language switch and notice components. The application uses the original theme/reset/Element Plus override/layout/page styles, UnoCSS configuration, SVG assets, app configuration provider and upstream app/settings/tag stores. Administrator and teacher login pages and all 404 screens directly import upstream components. Pagination across QOJ pages imports the original upstream Pagination component. Domain pages use the upstream page container and map existing QOJ tokens to the live upstream theme.

The template contains no online judge, contest messaging, problem test case editor, student registration/email binding or submission workflow. These QOJ domain screens and business logic remain in `src/vue`; their entire UI has **not** been proven pixel-identical to upstream pages with different fields and functionality. Do not confuse upstream source integrity with whole-site screenshot equivalence.

The six upstream script adaptations bridge profile/logout destinations, scoped tag refresh routes, notice destinations, route-specific layout selection and QOJ login contracts. Vue templates and style blocks remain byte-for-byte equivalent to the pinned upstream source. QOJ does not provide tenant switching or template QR authentication APIs: tenant switching stays feature-gated off, and QR login reports its unsupported contract. Template login demo accounts are upstream examples, not QOJ accounts. Existing student registration, email binding and password reset flows remain on their QOJ screens. No backend routes or credentials are copied from upstream.

```sh
npm run verify:template
npm run build
npm run dev -- --port 5178
npm run test:e2e:layout
```

Set `LAYOUT_ADMIN_PREFIX` to `VITE_ADMIN_PREFIX` (E2E default `auth_ac`), and `PLAYWRIGHT_MODULE` / `CHROMIUM_PATH` for another browser installation. E2E uses deterministic HTTP fixtures and stores screenshots, `report.json` and `trace.zip` in `.runtime/upstream-template/`. `source-report.json` verifies all 396 upstream files, including all 143 Vue templates and style blocks. The browser report verifies template interactions and integration, not live backend business behavior or whole-site pixel equivalence.

## Public homepage and solver scope

The public portal uses its own frontend navigation, without management tools or tabs. Header content and main content share a centered container (1200px maximum width, 24px side gutters on desktop and 16px on mobile). Mobile navigation uses an Element Plus drawer. Homepage sections use upstream SectionTitle and NoticeDetailDialog with Element Plus cards, statistics, carousel, tables, links and tags. Existing QOJ APIs provide homepage content.

The solver change is limited to tab buttons and accessible labels on debug textareas. Its script, remaining template, remaining styles and Monaco component are checked against the pre-change hashes in `docs/frontend-home-protected-scope.json`.

```sh
npm run test:e2e:frontend
```

Run against the same development server at port 5178 (`LAYOUT_BASE_URL` overrides it). The test uses deterministic HTTP fixtures, verifies desktop/tablet/mobile navigation, exact header/main/content alignment and homepage content, opens the upstream announcement dialog, and exercises solver tabs and debug input/output while asserting unchanged column geometry. Repeatable screenshots, `report.json` and `trace.zip` are saved in `.runtime/frontend-home/`. These fixtures verify frontend behavior, not live judge execution.

## Submission management and queue filters

`npm run test:e2e:submissions` verifies submission table columns, queue pagination/filter reset, combined problem/contest/language/status filters, supported sort values, stale statistics responses and contest-scoped reset. It uses the development server and browser environment variables described above. Deterministic HTTP fixtures, request parameters, screenshots and trace are saved to `.runtime/submission-filters/`; the test does not execute live judge tasks.

## Management page layout

Administrator and teacher domain pages remove duplicate in-page H1 titles and local refresh/reload controls. Navigation labels, section headings and form/dialog labels remain. List actions, filters, cards and pagination use a shared management-only content stylesheet at `src/vue/styles/management.css`. Page content grows naturally inside the upstream scrolling main area; tables scroll within their own containers. Narrow layouts stack filters and form columns, keep action groups wrapped, and constrain teleported management dialogs to the viewport. Public navigation and the student problem solver do not use this stylesheet's selectors.

```sh
npm run test:e2e:pages
```

This test derives all 72 domain routes from the router (including creation/editing/details/reports and queue aliases), uses deterministic API fixtures, and checks them at 1440px, 1024px and 390px. It asserts no page titles/local reload buttons, no document/content overflow, no vertically clipped page content, and responsive creation dialogs. Screenshots, a browsable `gallery.html`, `report.json` and Playwright `trace.zip` are saved in `.runtime/management-layout/`. These layout fixtures do not verify live backend persistence.

### 内容完整显示与滚动验证

内容样式集中在 `src/vue/styles/content.css`：表格、按钮、标签及表单标签允许换行，普通预览和表单随内容展开，弹窗仅由外层遮罩滚动。编辑器与聊天记录保留独立滚动。比赛选题列表每页 10 条，搜索后回到第一页，添加题目导致总页数减少时校正当前页。

重复验证（先启动 Vite，默认测试地址为 `http://127.0.0.1:5178`）：

```sh
LAYOUT_LONG_TEXT=1 MANAGEMENT_OUTPUT=.runtime/content-layout npm run test:e2e:pages
LAYOUT_LONG_TEXT=1 FRONTEND_OUTPUT=.runtime/content-frontend npm run test:e2e:frontend
LAYOUT_PICKER=1 LAYOUT_LONG_TEXT=1 MANAGEMENT_PATHS=/auth_ac/contests/new,/teacher/contests/new MANAGEMENT_OUTPUT=.runtime/content-picker npm run test:e2e:pages
```

后台报告、截图画廊和浏览器 trace 位于 `.runtime/content-layout/`；前台长文本截图与 trace 位于 `.runtime/content-frontend/`；分页和筛选联动报告位于 `.runtime/content-picker/`。测试使用固定 API 数据，不依赖生产账号或数据库。

### AI 配置表单与内容宽度

`AdminAiSettingsPage.vue` 通过现有 `/api/admin/v1/settings/system/agent` 接口加载和保存七个配置字段，使用 Element Plus 表单、输入框、数字输入框、选择器及开关。密钥不回显，留空保存保留后端原值，替换成功后清空输入框。超时和代码上下文长度沿用后端范围校验。

后台个人信息和设置表单取消固定宽度上限，桌面个人信息使用两列，窄屏恢复一列。前台在宽度 ≥1024px 时导航与主内容统一占视口宽度 80%，平板和手机保留自适应边距；写题工作区保持原有分栏布局。

```sh
LAYOUT_AI_SETTINGS=1 MANAGEMENT_PATHS=/auth_ac/ai/settings,/auth_ac/profile,/teacher/profile,/auth_ac/settings/frontend,/auth_ac/settings/system MANAGEMENT_OUTPUT=.runtime/ai-width npm run test:e2e:pages
FRONTEND_OUTPUT=.runtime/frontend-width npm run test:e2e:frontend
MANAGEMENT_OUTPUT=.runtime/management-width npm run test:e2e:pages
```

上述浏览器检查包含 AI 配置加载、校验、空密钥保存、密钥替换、保存后重新加载，以及 1024/1440/1920px 前台宽度和导航对齐。对应目录保留报告、截图和 trace。
