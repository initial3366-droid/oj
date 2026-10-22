# AI 配置刷新回显回归

修改前列出的失败场景：

- GET 返回 enabled=true 及已有配置，初次进入却被默认值覆盖。
- 手动刷新、浏览器刷新或离开后返回，配置再次丢失。
- 修改配置并保存后刷新，表单不能显示服务端保存的值。
- 加载失败时展示默认关闭状态，允许误保存覆盖原有配置。
- 加载或保存尚未完成时再次操作，覆盖输入或重复保存。
- API Key 误回显；留空保存时误清空服务端密钥。

验证：启动 Vite 后执行 `node tools/verify-ai-settings-refresh.mjs`。脚本使用真实 React 页面及模拟 HTTP 配置存储，不调用模型、不改真实数据库。输出 `.runtime/ai-settings-refresh/report.json`、截图和 Playwright trace。

结果：修改前 GET 返回 enabled=true，浏览器实际显示 false，复现证据位于 `.runtime/ai-settings-refresh-before/`。根因是 `AdminPageContainer` 的 Arco `Card.loading` 卸载了表单，`setFieldsValue` 后重新挂载又应用 `initialValues`。改为保留子组件的 `Spin`，并在加载失败或请求处理中禁用保存；请求序号防止过期响应回填。后端已有数据库读写逻辑不变，密钥仍不回显，留空保存保留原值。8 项浏览器回归通过，真实服务端配置未修改。

新增 `max`：前端推理强度选项、类型和服务端归一化允许值同步增加 `max`，避免保存时降为 `medium`。浏览器脚本增加选择 max、检查 PUT 值及刷新回显的场景。执行 `AI_SETTINGS_OUTPUT_DIR=.runtime/ai-settings-max node tools/verify-ai-settings-refresh.mjs` 可生成本轮 9 项回归记录。
