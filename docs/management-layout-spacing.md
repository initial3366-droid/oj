# 管理界面间距与响应式布局

本次统一样式在 `src/vue/styles/management-spacing.css`，由 Vue 入口在内容基础样式后加载。范围为管理端内容以及后台打开的弹窗，不修改上游 vendor 模板和公开页面。

- 页面区块间距 24px，桌面页面与卡片正文内边距 24px，窄屏内边距 16px。
- 搜索、筛选和选择工具栏间距 16px，操作按钮间距 12px；取消 Element Plus 按钮自带左边距与 flex gap 的重复叠加。
- 表单字段下边距 24px、顶部标签到控件间距 12px；帮助文字单独占行，校验错误参与正常布局，避免压住下一项。
- 多列字段、开关、选项与按钮在窄屏换行，表格行操作可换行；表格自身保持横向滚动。
- 通知和相邻表单分隔 24px；弹窗底部按钮可换行并保持 12px 间距。
- 聊天页保持独立滚动和输入区；统一 680–800px 之间曾冲突的侧栏断点。保留题面格式选择器的 112px 宽度。

## 验证方式

先运行 `npm run dev`。

```sh
LAYOUT_BASE_URL=http://127.0.0.1:5173 \
MANAGEMENT_OUTPUT=.runtime/management-spacing/verified \
node tools/verify-management-spacing.mjs

LAYOUT_BASE_URL=http://127.0.0.1:5173 \
MANAGEMENT_OUTPUT=.runtime/management-spacing/long-verified \
LAYOUT_LONG_TEXT=1 LAYOUT_WIDTHS=1024,390 \
node tools/verify-management-spacing.mjs

LAYOUT_BASE_URL=http://127.0.0.1:5173 \
MANAGEMENT_OUTPUT=.runtime/management-spacing/deep \
LAYOUT_DEEP=1 node tools/verify-management-spacing.mjs
```

可通过 `CHROMIUM_PATH`、`PLAYWRIGHT_MODULE` 指定浏览器与 Playwright 路径。

覆盖后台和共享教师端的 78 个路由，标准宽度为 1440、1024、768、390px。检查可见控件相交、普通独立控件低于 12px 的相邻间距、容器越界、标签裁切及整页横向溢出；分段按钮、分页、编辑器内部结构等复合控件不按独立按钮拆开计算。

额外检查新增专业、教师、学生、班级、课程等弹窗，公式与图片弹窗、名单导入、比赛各标签页，以及表单校验错误。聊天及题目编辑流程沿用现有浏览器 E2E 做回归。

产物包含 report.json、截图、gallery.html 和 trace.zip。所有批量页面检查使用确定性 API 模拟数据，验证真实 Vue 页面布局；不代表生产数据、任意长度内容或所有未打开状态均已验证。此次不涉及生产部署。
