#!/usr/bin/env bash
# Install a new immutable release. Configuration, database and judge tokens remain on the host.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo '请使用 sudo 运行。' >&2; exit 1; }
qoj_source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -e /etc/qoj/backend.env && -L /opt/qoj/current ]] || { echo '未找到原部署，请先安装。' >&2; exit 1; }
cd "$qoj_source_root"
sha256sum -c SHA256SUMS > /dev/null
python3 - "$qoj_source_root/build-info.json" <<'PY'
import json, sys
from pathlib import Path
old=json.loads(Path('/opt/qoj/current/build-info.json').read_text())
new=json.loads(Path(sys.argv[1]).read_text())
if old['adminPrefix'] != new['adminPrefix'] or old['adminApiPrefix'] != new['adminApiPrefix']:
    raise SystemExit('前后端后台前缀发生变化，请先同步 /etc/qoj/backend.env；不能直接升级。')
PY
qoj_release_id="$(python3 -c 'import json; print(json.load(open("build-info.json"))["releaseId"])')"
[[ $qoj_release_id =~ ^qoj-native-[0-9]{8}-[0-9]{6}$ ]] || { echo '发布标识无效' >&2; exit 1; }
qoj_destination="/opt/qoj/releases/$qoj_release_id"
[[ ! -e $qoj_destination ]] || { echo '该版本已存在，无需重复升级。' >&2; exit 1; }
qoj_previous_release="$(readlink -f /opt/qoj/current)"
install -d -m 755 "$qoj_destination"
rsync -a "$qoj_source_root/" "$qoj_destination/"
chown -R root:root "$qoj_destination"
chmod -R a+rX "$qoj_destination"
systemctl stop qoj-backend
qoj_backup_file="/var/backups/qoj/pre-$qoj_release_id.sql"
if ! python3 "$qoj_previous_release/scripts/backup-mysql.py" "$qoj_backup_file"; then
  systemctl start qoj-backend
  echo '升级前备份失败，已尝试重新启动旧后端，未切换当前版本。' >&2
  exit 1
fi
ln -sfn "$qoj_destination" /opt/qoj/current
install -m 644 "$qoj_destination/systemd/qoj-backend.service" /etc/systemd/system/qoj-backend.service
systemctl daemon-reload
bash "$qoj_destination/scripts/start.sh"
echo "旧版本：$qoj_previous_release"
echo "升级前数据库备份：$qoj_backup_file"
echo '若启动迁移失败，先查看日志；数据库迁移后不能只切换旧 JAR 回滚。'
