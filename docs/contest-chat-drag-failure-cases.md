# 比赛聊天拖动：实现前失败场景

- 拖动聊天按钮触发 click，把聊天面板意外打开或关闭。
- 面板只能从标题栏拖动；输入、选中文本、滚动消息、关闭/发送/切换分类不应触发拖动。
- 鼠标移出按钮或面板后拖动丢失；pointercancel 后仍处于拖动状态。
- 按钮移到边缘后打开面板超出屏幕；广播提示出现、内容变化、窗口缩小时失去可见位置。
- 手机触摸拖动变成滚屏；触摸后点击无法开关。
- 比赛介绍和写代码页面行为不同；拖动导致消息连接重新建立或编辑器草稿丢失。
- 拖动后答疑、广播、权限校验失效。

使用共享浮层坐标，聊天按钮及面板标题栏作为拖动入口；Pointer Events 支持鼠标/触摸/笔，设置拖动阈值避免点击误判，通过尺寸观察和窗口变化限制可见范围。使用浏览器 E2E 及既有真实后端答疑/广播 E2E 验证，不新增单元测试。

## 实现与复现

共享浮层使用 right/bottom 坐标，按钮和面板标题栏支持 Pointer Events 拖动；6px 阈值区分点击和拖动，通过 Pointer Capture 支持移出拖动区域继续操作。拖动后的兼容 click 被拦截，新指针操作或键盘操作恢复点击；真实触摸测试发现 touch click 可为 detail=0，因此不使用 detail 判断键盘操作。

ResizeObserver 和窗口 resize 在展开面板、出现广播提示、改变内容尺寸时重新限制位置，保持 8px 屏幕边距；消息列表允许收缩，保留滚动。输入框、消息内容、分类、发送和关闭按钮不作为拖动入口。

复现：`npm run build`；`QOJ_E2E_BACKEND_JAR=backend/target/qoj-backend-0.1.0.jar QOJ_E2E_OUTPUT_DIR=output/contest-chat-drag-e2e node tools/e2e/contest-messaging.mjs`。本次 E2E 用此前已验证的后端 JAR，避免本地 IDE 生成的 target/classes 干扰；未修改后端业务源码。

浏览器验证比赛介绍/写代码页：鼠标拖动按钮不误开关、拖标题栏后草稿保留、四周边界约束、375px 窗口、CDP 真实触摸输入拖动面板和按钮、键盘 Enter 打开。既有答疑/广播、报名权限、WebSocket 断连恢复、无消息轮询验证继续执行。截图保存在 output/contest-chat-drag-e2e/draggable-chat-*.png；报告和网络证据在同一目录。

验证完成：完整答疑/广播回归 18 项通过。随后补充 pointercancel 清理，使用 QOJ_E2E_DRAG_ONLY=1 在同一真实后端 E2E 中重新验证鼠标、触摸、触摸取消、键盘、边界、窗口变化和草稿保留（output/contest-chat-drag-cancel-e2e/report.json）。前端 TypeScript/Vite 构建通过；两次测试各自创建的账号、比赛均已清理。最终源码和 dist 入口哈希见 output/contest-chat-drag-cancel-e2e/verification.json。

本次只修改前端，dist 已重新构建；尚未部署，旧 release 包不包含此次拖动功能。
