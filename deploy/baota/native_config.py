"""Shared helpers for on-server configuration; no shell evaluation of secrets."""
import contextlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile


def load_env(path=Path('/etc/qoj/backend.env')):
    result = {}
    for line in Path(path).read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        key, value = line.split('=', 1)
        parts = shlex.split(value)
        result[key] = parts[0] if parts else ''
    return result


def write_env(path, values):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = ''.join(f'{key}={json.dumps(str(value), ensure_ascii=False)}\n' for key, value in values.items())
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        stream.write(text)


@contextlib.contextmanager
def mysql_options(values):
    with tempfile.TemporaryDirectory(prefix='qoj-mysql-') as directory:
        path = Path(directory) / 'client.cnf'
        path.write_text('[client]\n' + ''.join(
            f'{key}={json.dumps(str(values[field]), ensure_ascii=False)}\n' for key, field in [
                ('host', 'MYSQL_HOST'), ('port', 'MYSQL_PORT'),
                ('user', 'MYSQL_USERNAME'), ('password', 'MYSQL_PASSWORD')])
            + 'protocol=tcp\ndefault-character-set=utf8mb4\nmax-allowed-packet=256M\n')
        path.chmod(0o600)
        yield path


def mysql_query(values, query):
    with mysql_options(values) as options:
        result = subprocess.run([values.get('QOJ_MYSQL_CLIENT', '/www/server/mysql/bin/mysql'), f'--defaults-extra-file={options}', '--batch',
            '--skip-column-names', values['MYSQL_DATABASE']], input=query, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode:
            raise SystemExit('MySQL 操作失败，请检查数据库地址、账号权限和 /etc/qoj/backend.env。')
        return result.stdout.strip()
