# 导航与刷新排查：编码前失败清单

- 管理员基础路径尾部多斜杠导致新建、编辑、返回、发布、报告跳转落入404。
- 修复按钮后，已打开的旧双斜杠链接仍无法恢复。
- 顶部刷新、页签菜单刷新、右键刷新跳转中转页失败，或丢失查询参数和hash。
- 中转页路径参数可能为数组，字符串化后出现逗号。
- 关闭页签返回上一页或首页拼错管理员前缀。
- 浏览器直接打开或刷新含下划线/数字/短横线的自定义后台路径被后端路由拒绝。
- 前台课程等Vue有效路由未放行，浏览器刷新返回401/404。
- 过宽SPA fallback把API错误或不存在的静态资源伪装成index.html；真实JS/CSS被当作HTML。
- 修复路径时错误修改query中https://或hash，或跨端跳转到错误门户。

验证：所有后台/教师端注册页面使用固定API夹具真实渲染与顶部刷新；重点验证文件夹编辑、新建、题单/发布/报告跳转、带参数刷新、旧双斜杠链接。真实后端HTTP验证页面fallback、静态资源和API边界，保存JSON、截图与trace。保留既有单元测试，不新增单元测试。

## 修复位置

- `src/utils/adminPath.ts`：空子路径不再携带尾斜杠，统一修复文件夹新建/编辑/返回、题单新建/编辑/发布/发布实例编辑/报告返回，以及刷新地址拼接。
- `src/vue/template-adapter/RedirectPage.vue`：刷新中转保留 query 与 hash，正确处理数组路径参数。
- `src/vue/router/index.ts`：恢复旧的重复斜杠链接，仅处理 pathname，保留查询参数与锚点。
- `backend/src/main/java/com/qoj/config/SpaForwardController.java`：后台按配置前缀匹配，支持 auth_ac 等前缀；明确教师、课程和刷新中转页面范围，避免静态资源被错误返回 HTML。
- `backend/src/main/java/com/qoj/config/SecurityConfig.java`：放行课程及前台刷新中转 HTML 页面，API 权限规则保持原有约束。

## 重复验证

前端开发服务启动后执行 `node tools/verify-navigation-refresh.mjs` 与 `node tools/verify-folder-create-navigation.mjs`。前者使用固定 API 数据，覆盖后台、教师端注册页面及三种刷新入口；后者验证文件夹创建、详情、返回和编辑按钮。截图、JSON 报告与 Playwright trace 分别保存在 `.runtime/navigation-audit/` 与 `.runtime/folder-create-navigation/`。

后端启动且内嵌前端与 dist 一致时执行 `python3 tools/verify-spa-refresh.py`。支持 `QOJ_HTTP_BASE`、`QOJ_ADMIN_PREFIX` 覆盖地址与前缀，生成 `.runtime/navigation-audit/http-after.json`。

既有后端测试 189 项通过，前端构建与模板完整性检查通过。

浏览器验证结果：72 个后台/教师端页面，80 项刷新及历史链接检查全部通过；两端文件夹创建/编辑流程通过；真实后端 11 项页面、静态资源与 API 检查通过。
