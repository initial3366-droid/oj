#!/usr/bin/env python3
"""Explicitly set an existing super administrator password after first-start migrations."""
import getpass
import os
import re
import sys
import bcrypt
from native_config import load_env, mysql_query

if os.geteuid() != 0:
    raise SystemExit('请使用 sudo 运行。')
username = sys.argv[1] if len(sys.argv) > 1 else 'admin'
if not re.fullmatch(r'[A-Za-z0-9_.-]{1,80}', username):
    raise SystemExit('管理员用户名格式无效。')
values = load_env()
if mysql_query(values, f"SELECT COUNT(*) FROM admin_users WHERE username='{username}' AND role='SUPER_ADMIN';") != '1':
    raise SystemExit('未找到该超级管理员；请先完成后端首次启动/数据库迁移。')
password = getpass.getpass('设置管理员新密码（至少 12 字符，输入不回显）：')
if len(password) < 12 or len(password.encode()) > 72:
    raise SystemExit('密码至少 12 个字符、最多 72 字节。')
if password != getpass.getpass('再次输入管理员新密码：'):
    raise SystemExit('两次密码不一致。')
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
mysql_query(values, f"UPDATE admin_users SET password_hash='{hashed}', updated_at=NOW() WHERE username='{username}' AND role='SUPER_ADMIN';")
print(f'已更新管理员 {username} 的密码。')
