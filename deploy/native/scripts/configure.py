#!/usr/bin/env python3
"""Generate fresh secrets on the destination server; never bundle a local .env."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import secrets
from urllib.parse import urlparse
from native_config import write_env


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('site_url', help='http://服务器IP 或 https://域名')
    parser.add_argument('--migrate', action='store_true', help='迁移时交互输入旧 JWT_SECRET')
    parser.add_argument('--check', action='store_true', help='仅检查站点地址，不写入配置')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('请使用 sudo 运行配置脚本。')
    url = urlparse(args.site_url)
    if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password \
        or url.path not in ('', '/') or url.query or url.fragment:
        raise SystemExit('site_url 必须是完整来源，例如 http://203.0.113.10 或 https://oj.example.com。')
    if any(c.isspace() for c in args.site_url) or not re.fullmatch(r'[A-Za-z0-9.-]+', url.hostname):
        raise SystemExit('使用 IPv4 地址或域名，地址中不能包含空白。')
    try:
        port = url.port
    except ValueError:
        raise SystemExit('站点端口必须是 80 或 443。')
    if port not in (None, 80, 443):
        raise SystemExit('本部署模板通过 80/443 提供服务。')
    if args.check:
        return
    directory = Path('/etc/qoj')
    directory.mkdir(mode=0o750, parents=True, exist_ok=True)
    if (directory / 'backend.env').exists():
        raise SystemExit('配置已存在，未覆盖密钥；请编辑 /etc/qoj/backend.env 后重启服务。')
    build = json.loads((Path(__file__).resolve().parents[1] / 'build-info.json').read_text())
    prefix = build['adminPrefix']
    jwt = secrets.token_hex(32)
    if args.migrate:
        jwt = getpass.getpass('输入旧服务的 JWT_SECRET（保留加密配置，输入不回显）：').strip()
        if len(jwt.encode()) < 32 or 'default' in jwt or 'change-this' in jwt:
            raise SystemExit('旧 JWT_SECRET 至少需要 32 字节且不能为默认值。')
    values = {
        'SPRING_PROFILES_ACTIVE': 'prod', 'SERVER_ADDRESS': '127.0.0.1', 'SERVER_PORT': '18080',
        'SERVER_FORWARD_HEADERS_STRATEGY': 'framework',
        'ADMIN_PATH_PREFIX': prefix, 'ADMIN_API_PREFIX': build['adminApiPrefix'],
        'MYSQL_HOST': '127.0.0.1', 'MYSQL_PORT': '3306', 'MYSQL_DATABASE': 'qoj',
        'MYSQL_USERNAME': 'qoj', 'MYSQL_PASSWORD': secrets.token_hex(32),
        'MYSQL_SESSION_TIME_ZONE': '+08:00', 'REDIS_HOST': '127.0.0.1', 'REDIS_PORT': '16379',
        'REDIS_PASSWORD': secrets.token_hex(32), 'JWT_SECRET': jwt,
        'JWT_ACCESS_EXPIRE': '900', 'JWT_REFRESH_EXPIRE': '604800',
        'GO_JUDGE_BASE_URL': 'http://127.0.0.1:15050', 'GO_JUDGE_AUTH_TOKEN': secrets.token_hex(32),
        'AGENT_INTERNAL_TOKEN': secrets.token_hex(32),
        'CORS_ALLOWED_ORIGINS': args.site_url.rstrip('/'),
        'LOG_PATH': '/var/log/qoj', 'TZ': 'Asia/Shanghai', 'QOJ_TIME_ZONE': 'Asia/Shanghai',
    }
    write_env(directory / 'backend.env', values)
    write_env(directory / 'judge.env', {'GO_JUDGE_AUTH_TOKEN': values['GO_JUDGE_AUTH_TOKEN']})
    write_env(directory / 'agent.env', {'AGENT_INTERNAL_TOKEN': values['AGENT_INTERNAL_TOKEN']})
    (directory / 'redis.conf').write_text(f'''bind 127.0.0.1
protected-mode yes
port 16379
requirepass {values['REDIS_PASSWORD']}
dir /var/lib/qoj-redis
appendonly yes
appendfsync everysec
maxmemory 512mb
maxmemory-policy noeviction
save 900 1
save 300 10
logfile ""
''')
    (directory / 'redis.conf').chmod(0o640)
    template = (Path(__file__).resolve().parents[1] / 'nginx/qoj.conf').read_text()
    (directory / 'nginx.conf').write_text(template.replace('__SERVER_NAME__', url.hostname))
    (directory / 'nginx.conf').chmod(0o644)
    print(f'已生成新服务器配置，后台地址：{args.site_url.rstrip("/")}/{prefix}')
    print('密钥只保存在 /etc/qoj/，未输出到终端。')


if __name__ == '__main__':
    main()
