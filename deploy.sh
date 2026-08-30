#!/usr/bin/env bash
# QOJ 一键部署脚本：生成随机密钥配置并用 Docker Compose 拉起完整技术栈。
#
# 适用平台：Linux / macOS / Windows（WSL 或 Git Bash），需要 Docker 与 Compose v2。
# 常用命令：
#   ./deploy.sh          # 首次自动生成 .env.production，构建并启动全部服务
#   ./deploy.sh logs     # 跟踪日志
#   ./deploy.sh ps       # 查看各服务状态
#   ./deploy.sh down     # 停止（数据卷保留）
#   ./deploy.sh init     # 只生成/检查 .env.production，不启动
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV_FILE=".env.production"
# 源码目录使用 docker-compose.yml（含镜像构建）；免源码部署目录只有
# docker-compose.prebuilt.yml，自动识别。也可用 QOJ_COMPOSE_FILE 显式指定。
if [ -n "${QOJ_COMPOSE_FILE:-}" ]; then
  COMPOSE_FILE="$QOJ_COMPOSE_FILE"
elif [ -f docker-compose.yml ]; then
  COMPOSE_FILE="docker-compose.yml"
else
  COMPOSE_FILE="docker-compose.prebuilt.yml"
fi
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

log() { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[deploy]\033[0m %s\n' "$*" >&2; exit 1; }

# 生成 64 位十六进制随机串，满足后端 prod profile 对 JWT_SECRET 与判题令牌的强校验。
gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

check_docker() {
  command -v docker >/dev/null 2>&1 || die "未检测到 docker，请先安装：https://docs.docker.com/get-docker/"
  docker info >/dev/null 2>&1 || die "Docker 未运行，请先启动 Docker Desktop / dockerd"
  docker compose version >/dev/null 2>&1 || die "缺少 Compose v2 插件（docker compose）"
}

init_env() {
  if [ -f "$ENV_FILE" ]; then
    log "使用现有 ${ENV_FILE}（如需重新生成密钥请先删除该文件）"
    return
  fi
  log "生成 ${ENV_FILE}，自动填入随机密钥（可编辑后重新 ./deploy.sh）"
  local jwt judge mysql_pwd mysql_root redis_pwd
  jwt="$(gen_secret)"
  judge="$(gen_secret)"
  mysql_pwd="$(gen_secret)"
  mysql_root="$(gen_secret)"
  redis_pwd="$(gen_secret)"
  cat > "$ENV_FILE" <<EOF
# 由 deploy.sh 生成；含敏感密钥，已被 .gitignore 排除，请勿提交。
QOJ_HTTP_PORT=80
TZ=Asia/Shanghai
SPRING_PROFILES_ACTIVE=prod
JWT_ACCESS_EXPIRE=900
JWT_REFRESH_EXPIRE=604800
MYSQL_DATABASE=qoj
MYSQL_USERNAME=qoj
MYSQL_ROOT_PASSWORD=$mysql_root
MYSQL_PASSWORD=$mysql_pwd
REDIS_PASSWORD=$redis_pwd
JWT_SECRET=$jwt
GO_JUDGE_AUTH_TOKEN=$judge
GO_JUDGE_PARALLELISM=1
GO_JUDGE_MEM_LIMIT=2g
GO_JUDGE_CPUS=2.0
BACKEND_MEM_LIMIT=2g
MYSQL_MEM_LIMIT=1g
EOF
  chmod 600 "$ENV_FILE"
}

# 等待前端/nginx 就绪即认为整栈可用（nginx 依赖后端健康检查通过后才会启动）。
wait_ready() {
  # shellcheck disable=SC1090
  set -a; . "./$ENV_FILE"; set +a
  local port="${QOJ_HTTP_PORT:-80}" i
  for i in $(seq 1 60); do
    if curl -fsS -o /dev/null "http://127.0.0.1:${port}/" 2>/dev/null; then
      log "服务已就绪"
      log "  用户端:    http://localhost:${port}/"
      log "  管理后台:  http://localhost:${port}/admin/"
      log "  端口或域名不同时，请按实际地址访问。"
      log "  常用命令:  ./deploy.sh logs | ps | down"
      return 0
    fi
    sleep 5
  done
  log "5 分钟内未就绪，请排查: ${COMPOSE[*]} logs -f backend"
  return 1
}

cmd="${1:-up}"
shift 2>/dev/null || true

case "$cmd" in
  init)
    init_env
    ;;
  up)
    check_docker
    init_env
    log "构建并启动（首次构建需下载依赖，可能耗时 5-15 分钟，之后走缓存）"
    "${COMPOSE[@]}" up -d --build "$@"
    wait_ready
    ;;
  down)
    check_docker
    "${COMPOSE[@]}" down "$@"
    ;;
  logs)
    "${COMPOSE[@]}" logs -f --tail=200 "$@"
    ;;
  ps|status)
    "${COMPOSE[@]}" ps
    ;;
  restart)
    "${COMPOSE[@]}" restart "$@"
    ;;
  *)
    sed -n '2,12p' "${BASH_SOURCE[0]}"
    exit 1
    ;;
esac
