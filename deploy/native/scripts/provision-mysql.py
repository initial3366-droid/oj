#!/usr/bin/env python3
"""Initialize a local MySQL database and dedicated account without replacing a database."""
import os
import re
import subprocess
from native_config import load_env, mysql_query

if os.geteuid() != 0:
    raise SystemExit('请使用 sudo 运行。')
values = load_env()
for key in ['MYSQL_DATABASE', 'MYSQL_USERNAME']:
    if not re.fullmatch(r'[A-Za-z0-9_]+', values[key]):
        raise SystemExit(f'{key} 必须只包含字母、数字和下划线。')
if values['MYSQL_HOST'] != '127.0.0.1' or values['MYSQL_PORT'] != '3306':
    raise SystemExit('自动建库脚本只用于本机 3306 MySQL；已有/远程数据库请按教程手动配置。')
if not re.fullmatch(r'[a-f0-9]{64}', values['MYSQL_PASSWORD']):
    raise SystemExit('已配置自定义数据库密码，请手动建库授权；脚本不会自动改写密码。')
database, username, password = (values[k] for k in ['MYSQL_DATABASE', 'MYSQL_USERNAME', 'MYSQL_PASSWORD'])
sql = f'CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n'
for host in ['localhost', '127.0.0.1']:
    sql += f"CREATE USER IF NOT EXISTS '{username}'@'{host}' IDENTIFIED BY '{password}';\n"
    sql += f"GRANT ALL PRIVILEGES ON `{database}`.* TO '{username}'@'{host}';\n"
result = subprocess.run(['mysql', '--protocol=socket', '-u', 'root'], input=sql, text=True,
    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
if result.returncode:
    raise SystemExit('本机 MySQL root socket 登录/建库失败。请用 sudo mysql 建立数据库和专用账号；不需要修改 root 登录方式。')
mysql_query(values, 'SELECT 1;')
print('MySQL 原生数据库和专用账号可用；未删除数据库或更改已有账号密码。')
