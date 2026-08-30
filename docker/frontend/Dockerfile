# QOJ 前端镜像：Node 编译 SPA + Nginx 托管静态资源并同源反代后端 API/WebSocket。
# 构建上下文是仓库根目录（compose 已指定 context: .）。
# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /build

# 可选 npm 镜像源，国内网络可传入 https://registry.npmmirror.com 加速。
ARG NPM_REGISTRY=https://registry.npmjs.org
# 管理后台路由前缀，构建期固化进产物；需与后端 admin.path-prefix 保持一致。
ARG VITE_ADMIN_PREFIX=admin
ENV VITE_ADMIN_PREFIX=$VITE_ADMIN_PREFIX
# 管理后台 API 前缀，必须与后端 ADMIN_API_PREFIX 使用同一环境变量值。
ARG VITE_ADMIN_API_PREFIX=/api/admin/v1
ENV VITE_ADMIN_API_PREFIX=$VITE_ADMIN_API_PREFIX

COPY package.json package-lock.json ./
RUN npm config set registry "$NPM_REGISTRY" \
 && npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=10 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
