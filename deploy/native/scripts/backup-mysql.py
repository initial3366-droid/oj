#!/usr/bin/env python3
"""Backup schema/data AND Flyway history from a native MySQL server."""
import argparse
import os
from pathlib import Path
import subprocess
from native_config import load_env, mysql_options

parser = argparse.ArgumentParser()
parser.add_argument('output', help='输出 SQL 文件路径（文件必须尚不存在）')
args = parser.parse_args()
if os.geteuid() != 0:
    raise SystemExit('请使用 sudo 运行。')
path = Path(args.output).resolve()
path.parent.mkdir(parents=True, exist_ok=True)
descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, 'wb') as stream, mysql_options(load_env()) as options:
    result = subprocess.run(['mysqldump', f'--defaults-extra-file={options}', '--single-transaction',
        '--quick', '--no-tablespaces', '--set-gtid-purged=OFF', '--hex-blob',
        '--default-character-set=utf8mb4', load_env()['MYSQL_DATABASE']], stdout=stream, stderr=subprocess.PIPE)
if result.returncode:
    path.unlink()
    raise SystemExit('备份失败；请检查 MySQL 账号权限与数据库连接。')
print(f'备份已写入 {path}（权限 600）')
