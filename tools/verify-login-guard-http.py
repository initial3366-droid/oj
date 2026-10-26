"""Local HTTP E2E for mandatory login captchas and shared cross-portal lockouts.
Failure cases: omitted/null/empty captcha bypass; replay; portal/case/proxy-header
rotation; missing TTL erases lock; successful correct login broken.
Requires Docker MySQL/Redis, Maven, bcrypt and an empty Redis DB15.
"""
import json
import os
from pathlib import Path
import secrets
import signal
import socket
import subprocess
import time
import urllib.error
import urllib.request
import uuid
import bcrypt


def verify(root):
    database = 'qoj_login_e2e_' + uuid.uuid4().hex[:8]
    environment = dict(line.split('=', 1) for line in (root / '.env').read_text().splitlines()
                       if '=' in line and not line.lstrip().startswith('#'))
    checks = []
    passed = False
    process = None
    created = False
    redis_db = '15'

    def redis(*args):
        return subprocess.run(['docker', 'exec', '-e', 'REDISCLI_AUTH=' + environment.get(
            'REDIS_PASSWORD', 'qoj-redis-change-me-2026').strip('\"\''), 'qoj-redis',
            'redis-cli', '-n', redis_db, '--raw', *map(str, args)],
            text=True, capture_output=True, check=True).stdout.strip()

    def sql(query, db=None):
        return subprocess.run(['docker', 'exec', '-i', 'qoj-mysql', 'sh', '-c',
            'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -B ' + (db or database)],
            input="SET time_zone='+08:00'; " + query, text=True, capture_output=True, check=True).stdout.strip()

    assert redis('DBSIZE') == '0', 'Redis DB15 must be empty for isolated E2E'
    log = (root / '.runtime/security-remediation/login-guard-backend.log').open('w')
    try:
        sql('CREATE DATABASE ' + database + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;', 'qoj')
        created = True
        subprocess.run(['docker', 'exec', 'qoj-mysql', 'sh', '-c',
            'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysqldump -uroot --no-data --set-gtid-purged=OFF qoj | mysql -uroot ' + database],
            check=True, capture_output=True)
        sql('INSERT INTO flyway_schema_history SELECT * FROM qoj.flyway_schema_history;')
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        base = 'http://127.0.0.1:' + str(port)
        arguments = f'--server.port={port} --spring.datasource.url=jdbc:mysql://127.0.0.1:13306/{database}?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false'
        arguments += f' --spring.data.redis.database={redis_db} --qoj.jwt.secret={secrets.token_hex(32)}'
        process = subprocess.Popen(['mvn', 'spring-boot:run', '-Dspring-boot.run.arguments=' + arguments],
            cwd=root / 'backend', stdout=log, stderr=log, start_new_session=True)

        def http(path, body=None, token=None, expected=200, headers=None):
            request = urllib.request.Request(base + path,
                data=json.dumps(body).encode() if body is not None else None,
                headers={'Content-Type': 'application/json', **(headers or {}),
                         **({'Authorization': 'Bearer ' + token} if token else {})})
            try:
                response = urllib.request.urlopen(request, timeout=60)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                result = json.load(response)
            assert result['code'] == expected or (expected == 400 and response.status == 400), result
            return result.get('data')

        for _ in range(120):
            assert process.poll() is None, 'Backend exited; inspect login-guard-backend.log'
            try:
                captcha = http('/api/v1/captcha/image')
                break
            except OSError:
                time.sleep(0.5)
        else:
            raise AssertionError('Backend startup timed out')
        password = secrets.token_hex(9)
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        uid = int(sql("INSERT INTO users(username,password_hash,role,display_name,email) VALUES('sandbox_e2e','" + hashed + "','STUDENT','Sandbox E2E','sandbox@example.invalid'); SELECT LAST_INSERT_ID();"))
        session = http('/api/v1/auth/login', {'username': 'sandbox_e2e', 'password': password,
            'captchaId': captcha['captchaId'], 'captcha': redis('GET', 'oj:captcha:' + captcha['captchaId'])})
        token = session['accessToken']
        admin_prefix = environment.get('ADMIN_API_PREFIX', '/api/admin/v1').strip('"\'')
        portals = ['/api/v1/auth/login', '/api/teacher/v1/auth/login', admin_prefix + '/auth/login']
        name = 'shared_guard'
        sql("INSERT INTO users(username,password_hash,role,display_name,email) VALUES('" + name + "','" + hashed + "','STUDENT','Login guard','guard@example.invalid');")
        sql("INSERT INTO majors(code,name) VALUES('guard','Guard');")
        sql("INSERT INTO teachers(username,password_hash,display_name,major_id) VALUES('" + name + "','" + hashed + "','Guard',(SELECT id FROM majors LIMIT 1));")
        sql("INSERT INTO admin_users(username,password_hash,role,display_name) VALUES('" + name + "','" + hashed + "','SUPER_ADMIN','Guard');")
        key = 'oj:auth:login-fail:source:127.0.0.1:' + name

        def challenge():
            data = http('/api/v1/captcha/image')
            return {'captchaId': data['captchaId'], 'captcha': redis('GET', 'oj:captcha:' + data['captchaId'])}

        def body(secret=password, username=name):
            return {'username': username, 'password': secret, **challenge()}

        def check(label, **evidence):
            checks.append({'name': label, 'passed': True, **evidence})

        variants = [{}, {'captchaId': None, 'captcha': None}, {'captchaId': '', 'captcha': ''},
                    {'captchaId': 'fake'}, {'captcha': '1234'}, {'captchaId': 'fake', 'captcha': '1234'}]
        for portal in portals:
            for index, fields in enumerate(variants):
                http(portal, {'username': name, 'password': password, **fields}, expected=400)
                check(portal + ': rejects captcha variant ' + str(index))
            captcha = challenge()
            http(portal, {'username': name, 'password': password, **captcha, 'captcha': 'wrong'}, expected=400)
            http(portal, {'username': name, 'password': password, **captcha}, expected=400)
            check(portal + ': wrong captcha consumes challenge')
            captcha = challenge()
            http(portal, {'username': name, 'password': password, **captcha})
            http(portal, {'username': name, 'password': password, **captcha}, expected=400)
            check(portal + ': correct captcha is single-use and normal login works')
        assert redis('EXISTS', key) == '0'
        for index in range(5):
            http(portals[index % 3], body('definitely-wrong'), expected=40001)
        assert redis('GET', key) == '5'
        check('five failures across portals accumulate in one counter', count=5)
        for portal in portals:
            http(portal, body(), expected=429)
            check(portal + ': correct password cannot bypass shared lock')
        http(portals[0], body(username=name.upper()), expected=429)
        check('username case rotation cannot bypass lock')
        http(portals[1], body(), expected=429, headers={'X-Forwarded-For': '198.51.100.24'})
        check('untrusted forwarded address cannot bypass lock')
        redis('SET', key, '5')
        assert redis('TTL', key) == '-1'
        http(portals[2], body(), expected=429)
        assert redis('GET', key) == '5' and 0 < int(redis('TTL', key)) <= 900
        check('missing TTL repaired without erasing accumulated lock')
        for portal in portals:
            redis('SET', key, '4', 'EX', '900')
            result = http(portal, body())
            assert result.get('accessToken') and redis('EXISTS', key) == '0'
            check(portal + ': successful login clears sub-threshold failures')
        passed = True
        return checks
    finally:
        if process and process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        log.close()
        if created:
            sql('DROP DATABASE ' + database + ';', 'qoj')
        keys = redis('KEYS', '*').splitlines()
        if keys:
            redis('DEL', *keys)
        output = root / '.runtime/security-remediation/login-guard-report.json'
        output.write_text(json.dumps({'passed': passed, 'checks': checks,
            'command': 'python3 tools/verify-login-guard-http.py',
            'scope': 'disposable local backend/database; no public target contacted'},
            ensure_ascii=False, indent=2))


if __name__ == '__main__':
    result = verify(Path(__file__).resolve().parents[1])
    print(json.dumps({'checks': len(result), 'passed': True}))
