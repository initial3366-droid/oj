#!/usr/bin/env python3
import getpass
import os
from pathlib import Path
import re
import subprocess
from native_config import load_env, mysql_query

if os.geteuid() != 0:
    raise SystemExit('请使用 root 或 sudo。')
values = load_env()
if mysql_query(values, "SELECT COUNT(*) FROM admin_users WHERE username='admin' AND role='SUPER_ADMIN';") != '1':
    raise SystemExit('未找到超级管理员 admin，请先完成后端迁移。')
password = getpass.getpass('设置 admin 新密码（至少 12 字符，最多 72 字节）：')
if len(password) < 12 or len(password.encode()) > 72:
    raise SystemExit('密码长度不符合要求。')
if password != getpass.getpass('再次输入密码：'):
    raise SystemExit('两次密码不一致。')
vendor = Path(__file__).resolve().parent / 'vendor'
classpath = os.pathsep.join([str(vendor), str(vendor / '*')])
result = subprocess.run([values['QOJ_JAVA'], '-cp', classpath, 'BcryptHash'],
    input=password + '\n', text=True, encoding='utf-8', stdout=subprocess.PIPE, stderr=subprocess.PIPE)
hashed = result.stdout.strip()
if result.returncode or not re.fullmatch(r'\$2[aby]\$12\$[./A-Za-z0-9]{53}', hashed):
    raise SystemExit('密码哈希生成失败，请检查 Java 17 和修复包中的 vendor 文件。')
mysql_query(values, f"UPDATE admin_users SET password_hash='{hashed}', updated_at=NOW() WHERE username='admin' AND role='SUPER_ADMIN';")
print('管理员密码已设置。')
