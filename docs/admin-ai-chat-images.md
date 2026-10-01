# 后台 AI 聊天图片接口

「上传附件」入口位于文本框左侧，也支持粘贴图片。待发送图片在文本框上方预览，可点击放大、删除；失败可重试。允许只发送图片。图片与历史按管理员账号持久化到 MySQL，删除聊天时清理不再被其他聊天引用的图片。ZIP 和其他文件解析见 [AI 文件导入说明](admin-ai-chat-files.md)。

## 本站接口

以下路径使用默认后台前缀。实际部署会随 `ADMIN_PATH_PREFIX` 替换，前端复用 `adminClient` 的路径转换、Bearer 认证和令牌刷新。图片接口与聊天历史一样仅允许 `SUPER_ADMIN`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/admin/v1/agent/chat/images` | multipart/form-data，字段 `file`；返回图片元数据 |
| GET | `/api/admin/v1/agent/chat/images/{id}` | 返回当前管理员图片的原始字节，私有、不缓存 |
| DELETE | `/api/admin/v1/agent/chat/images/{id}` | 删除未发送图片；已被聊天引用时返回 409 |
| PUT | `/api/admin/v1/agent/chat/sessions/{id}` | 原有聊天保存接口，用户消息新增 `images` |
| POST | `/api/admin/v1/agent/chat/stream` | 原有 SSE 接口，用户消息新增 `images` |

上传响应沿用 `{code, message, data}`，例如：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "id": "a955c4bb-dc1c-4e77-b6cd-77c1a3f373ab",
    "name": "截图.png",
    "mimeType": "image/png",
    "size": 12345,
    "width": 640,
    "height": 480
  }
}
```

消息中的 `images` 使用上述元数据数组。后端只信任图片 ID，并从数据库校验归属、读取真实元数据。旧消息不传 `images` 仍兼容；图片只允许在 `user` 消息中。

```json
{
  "messages": [
    {"role": "user", "content": "分析截图中的问题", "images": [{"id": "a955c4bb-dc1c-4e77-b6cd-77c1a3f373ab"}]}
  ]
}
```

本站限制：JPEG、PNG、GIF、WebP，单张 5 MiB，宽高各不超过 4096 像素，每条消息最多 4 个附件（图片与其他文件合计），上下文图片总计不超过 20 MiB。服务端根据文件实际内容判断类型。超限/无效图片返回 400，读取或引用不属于当前管理员的图片返回 404；删除未引用的图片为幂等操作。

数据库迁移 `V92__admin_ai_chat_images.sql` 新建独立图片表；消息 JSON 只保存元数据，图片二进制不随每次聊天更新重复写入。无需配置公共对象存储，也不向浏览器暴露服务商密钥。备份聊天时应同时备份图片表。

## DeepSeek 适配

依据 [DeepSeek 官方视觉指南](https://api-docs.deepseek.com/guides/vision/)，上游使用标准 Chat Completions 的用户消息内容数组：

```json
{
  "model": "deepseek-flash",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "分析截图中的问题"},
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
    ]
  }],
  "stream": true
}
```

由 Spring AI `UserMessage.media` 将数据库里的图片转成 Base64 Data URL。DeepSeek 不需要访问本站的私有图片 URL，本地部署也能调用。没有使用其 Files API，上传到本站不等于上传到 DeepSeek。只有发送消息或生成首条消息标题时才将图片发给模型。

DeepSeek 官方地址 `api.deepseek.com` 的图片请求使用 `deepseek-flash`。已配置的旧 Flash 名称 `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` 仅在图片请求中映射到该名称；其他 DeepSeek 模型会提示切换模型。文本请求保留原有模型设置。首条消息即使只有图片，仍按图片内容自动生成 5～20 字标题。

## 可重复验证

启动 MySQL、Redis、后端后运行：

```sh
npm run build
QOJ_E2E_NGINX=1 QOJ_E2E_LIVE_IMAGE=1 node tools/e2e/admin-ai-stream.mjs
```

`QOJ_E2E_NGINX=1` 需要本地缓存的 `qoj-frontend:latest` 镜像；省略时用 Node 代理服务验证生产构建。`QOJ_E2E_LIVE_IMAGE=1` 调用当前配置的真实模型；省略时验证上传、持久化与浏览器交互，不发送图片给真实服务商。

产物在 `output/admin-ai-stream-e2e/`：`report.json`、数字图片测试素材、待发送预览、放大图、刷新恢复及真实识别截图。脚本同时回归表格、停止生成、流结束和超时行为，结束后删除临时账号及其聊天/图片。
