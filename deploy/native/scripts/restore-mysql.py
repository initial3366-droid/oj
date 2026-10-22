#!/usr/bin/env python3
"""Import only into an empty destination, before starting the QOJ backend."""
import argparse
import os
from pathlib import Path
import subprocess
from native_config import load_env, mysql_options, mysql_query

parser = argparse.ArgumentParser()
parser.add_argument('input', help='包含 schema/data/Flyway history 的 SQL 文件')
args = parser.parse_args()
if os.geteuid() != 0:
    raise SystemExit('请使用 sudo 运行。')
path = Path(args.input).resolve()
if not path.is_file():
    raise SystemExit('SQL 文件不存在。')
values = load_env()
if mysql_query(values, 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE();') != '0':
    raise SystemExit('目标数据库非空，已停止导入；请按教程改用新的空数据库，避免覆盖已有数据。')
if subprocess.run(['systemctl', 'is-active', '--quiet', 'qoj-backend']).returncode == 0:
    raise SystemExit('请先停止 qoj-backend，再导入数据库。')
with path.open('rb') as stream, mysql_options(values) as options:
    result = subprocess.run(['mysql', f'--defaults-extra-file={options}', values['MYSQL_DATABASE']],
        stdin=stream, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
if result.returncode:
    raise SystemExit('SQL 导入失败，数据库可能已有部分数据。请保留原备份，检查 MySQL 版本和 SQL 内容；不要直接重复导入。')
print('数据库已导入，包含原 Flyway 历史；可以启动后端执行后续迁移。')
