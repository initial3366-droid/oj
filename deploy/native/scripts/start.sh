#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo '请使用 sudo 运行。' >&2; exit 1; }
[[ $# -eq 0 || ( $# -eq 1 && $1 == --fresh ) ]] || { echo '用法：sudo bash scripts/start.sh [--fresh]' >&2; exit 1; }
systemctl enable --now qoj-redis qoj-backend
qoj_backend_ready=false
for ((qoj_attempt=0; qoj_attempt<120; qoj_attempt++)); do
  qoj_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:18080/api/v1/courses || true)"
  if [[ $qoj_status == 200 || $qoj_status == 401 || $qoj_status == 403 ]]; then
    qoj_backend_ready=true
    break
  fi
  sleep 1
done
if [[ $qoj_backend_ready != true ]]; then
  echo '后端尚未就绪；查看 sudo journalctl -u qoj-backend -n 100 --no-pager。' >&2
  exit 1
fi
# First start runs Flyway before Nginx exposes the application.
if [[ ${1:-} == --fresh ]]; then
  python3 /opt/qoj/current/scripts/set-admin-password.py admin
fi
nginx -t
systemctl enable --now nginx
systemctl reload nginx
echo '后端已启动，Nginx 配置已生效。请按 README.md 设置管理员密码并检查判题服务。'
