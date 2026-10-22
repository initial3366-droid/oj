#!/usr/bin/env bash
# Prepare a fresh Ubuntu LTS host. Backend starts separately, after optional data import.
set -euo pipefail
if [[ $EUID -ne 0 ]]; then
  echo '请使用 sudo bash scripts/install.sh http://服务器IP [--migrate]' >&2
  exit 1
fi
if [[ $# -lt 1 || $# -gt 2 || ( $# -eq 2 && $2 != --migrate ) ]]; then
  echo '用法：sudo bash scripts/install.sh http://服务器IP [--migrate]' >&2
  exit 1
fi
case "$1" in
  http://*|https://*) ;;
  *)
    echo '地址必须包含 http:// 或 https://，例如 http://36.137.172.149。' >&2
    exit 1
    ;;
esac
qoj_source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source /etc/os-release
if [[ $ID != ubuntu || ( $VERSION_ID != 26.04 && $VERSION_ID != 24.04 && $VERSION_ID != 22.04 ) ]]; then
  echo "检测到 ${PRETTY_NAME:-$ID $VERSION_ID}；本安装脚本适用于 Ubuntu 22.04/24.04/26.04。" >&2
  echo '请提供 cat /etc/os-release 和 uname -m 的结果，以便确认对应的部署方式。' >&2
  exit 1
fi
cd "$qoj_source_root"
if ! sha256sum --quiet -c SHA256SUMS; then
  echo '部署文件校验失败，以上 FAILED 行指出不一致的文件；安装尚未开始。' >&2
  echo '请从已校验的原始部署包恢复这些文件，或重新解压完整包到新目录后运行。' >&2
  exit 1
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update
# Ubuntu 26.04 provides Java 17 and Redis in universe; minimal cloud images may omit it.
apt-get install -y software-properties-common
add-apt-repository -y universe
apt-get update
apt-get install -y openjdk-17-jre-headless nginx mysql-server mysql-client \
  redis-server redis-tools python3 python3-bcrypt curl ca-certificates openssl rsync
# Validate the complete URL before creating a release or generating any configuration.
python3 "$qoj_source_root/scripts/configure.py" "$1" --check
qoj_release_id="$(python3 -c 'import json; print(json.load(open("build-info.json"))["releaseId"])')"
[[ $qoj_release_id =~ ^qoj-native-[0-9]{8}-[0-9]{6}$ ]] || { echo '发布标识无效' >&2; exit 1; }
qoj_destination="/opt/qoj/releases/$qoj_release_id"
install -d -m 755 /opt/qoj/releases
if [[ -e /opt/qoj/current && ! -L /opt/qoj/current ]]; then
  echo '/opt/qoj/current 已是普通目录，请手动处理后再安装。' >&2
  exit 1
fi
if [[ $qoj_source_root != "$qoj_destination" ]]; then
  [[ ! -e $qoj_destination ]] || { echo '该版本已存在，请使用 scripts/upgrade.sh。' >&2; exit 1; }
  install -d -m 755 "$qoj_destination"
  rsync -a "$qoj_source_root/" "$qoj_destination/"
fi
chown -R root:root "$qoj_destination"
chmod -R a+rX "$qoj_destination"
if ! id qoj > /dev/null 2>&1; then
  useradd --system --home-dir /var/lib/qoj --shell /usr/sbin/nologin qoj
fi
install -d -o qoj -g qoj -m 750 /var/lib/qoj /var/log/qoj
install -d -o redis -g redis -m 750 /var/lib/qoj-redis
if [[ ! -e /etc/qoj/backend.env ]]; then
  qoj_config_arguments=("$1")
  [[ ${2:-} != --migrate ]] || qoj_config_arguments+=(--migrate)
  python3 "$qoj_destination/scripts/configure.py" "${qoj_config_arguments[@]}"
else
  echo '复用 /etc/qoj/backend.env 中的现有配置，未覆盖密钥。'
fi
chown root:redis /etc/qoj /etc/qoj/redis.conf
chmod 750 /etc/qoj
chmod 640 /etc/qoj/redis.conf
install -m 644 "$qoj_destination/mysql/qoj.cnf" /etc/mysql/mysql.conf.d/qoj.cnf
systemctl enable --now mysql
systemctl restart mysql
python3 "$qoj_destination/scripts/provision-mysql.py"
ln -sfn "$qoj_destination" /opt/qoj/current
install -m 644 "$qoj_destination/systemd/qoj-backend.service" /etc/systemd/system/qoj-backend.service
install -m 644 "$qoj_destination/systemd/qoj-redis.service" /etc/systemd/system/qoj-redis.service
install -m 644 /etc/qoj/nginx.conf /etc/nginx/sites-available/qoj.conf
ln -sfn /etc/nginx/sites-available/qoj.conf /etc/nginx/sites-enabled/qoj.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now qoj-redis
echo '准备完成：MySQL/Redis 为原生服务，后端尚未启动，便于先导入旧数据库。'
echo '接下来按 README.md 启动 go-judge，然后运行 sudo bash /opt/qoj/current/scripts/start.sh。'
