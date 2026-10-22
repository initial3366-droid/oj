#!/usr/bin/env bash
# Official Docker apt repository; only used for the judge and optional isolated Agent.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo '请使用 sudo 运行。' >&2; exit 1; }
if command -v docker > /dev/null 2>&1 && docker compose version > /dev/null 2>&1; then
  echo 'Docker Engine 与 Compose 已存在。'
  exit 0
fi
source /etc/os-release
[[ $ID == ubuntu ]] || { echo '请按 Docker 官方文档安装当前系统的 Engine/Compose。' >&2; exit 1; }
if [[ "$(dpkg-query -W -f='${Status}' docker.io 2>/dev/null || true)" == 'install ok installed' ]]; then
  echo '已有 Ubuntu docker.io，请按 README.md 处理 Compose；本脚本不自动卸载现有 Docker。' >&2
  exit 1
fi
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker compose version
