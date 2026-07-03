#!/bin/bash

# QOJ Backend 启动脚本
# 确保环境变量正确加载

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 加载 .env 文件
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "加载环境变量从 $PROJECT_ROOT/.env"
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
else
    echo "警告: 未找到 .env 文件，使用默认配置"
fi

# 切换到 backend 目录
cd "$SCRIPT_DIR"

# 启动 Spring Boot
echo "启动后端服务..."
echo "MySQL: ${MYSQL_HOST:-localhost}:${MYSQL_PORT:-13306}"
echo "Redis: ${REDIS_HOST:-localhost}:${REDIS_PORT:-16379}"

mvn spring-boot:run
