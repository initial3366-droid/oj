"""Real local HTTP privacy E2E using an isolated database/backend.
Failure cases: anonymous enumeration; login/internal fields in public DTO;
owner/other/admin views bypass projection; blank display falls back to login;
private me/admin APIs break; leaderboard exposes login identifiers.
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
    database = 'qoj_profile_e2e_' + uuid.uuid4().hex[:8]
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
    log = (root / '.runtime/security-remediation/user-profile-backend.log').open('w')
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
            assert process.poll() is None, 'Backend exited; inspect user-profile-backend.log'
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
        private_login = 'private_login_name'
        other_id = int(sql("INSERT INTO users(username,password_hash,role,display_name,email,student_no) VALUES('" + private_login + "','" + hashed + "','STUDENT','Public Name','private@example.invalid','2026000001'); SELECT LAST_INSERT_ID();"))
        blank_id = int(sql("INSERT INTO users(username,password_hash,role,display_name,email) VALUES('hidden_blank_login','" + hashed + "','STUDENT','','blank@example.invalid'); SELECT LAST_INSERT_ID();"))
        sql("INSERT INTO admin_users(username,password_hash,role,display_name) VALUES('secret_admin_login','" + hashed + "','SUPER_ADMIN','Admin');")
        sql(f'INSERT INTO user_scores(user_id,ac_count,submit_count,total_score) VALUES({other_id},2,3,200);')
        public_keys = {'id', 'displayName', 'avatarUrl', 'acCount', 'submitCount', 'totalScore'}

        def check(label):
            checks.append({'name': label, 'passed': True})

        for target in [uid, other_id, 999999999, -1]:
            http('/api/v1/users/' + str(target), expected=401)
            check('anonymous profile lookup returns 401: ' + str(target))
        http('/api/v1/users/' + str(other_id), token='invalid-token', expected=401)
        check('invalid bearer token cannot read profile')
        for target in [uid, other_id]:
            result = http('/api/v1/users/' + str(target), token=token)
            assert set(result) == public_keys, result
            assert private_login not in json.dumps(result)
            check('authenticated profile has exact public projection: ' + str(target))
        result = http('/api/v1/users/' + str(other_id), token=token)
        assert result['displayName'] == 'Public Name' and result['acCount'] == 2 and result['submitCount'] == 3
        check('other-user display name and training statistics remain usable')
        result = http('/api/v1/users/' + str(blank_id), token=token)
        assert result['displayName'] == '用户' and 'hidden_blank_login' not in json.dumps(result)
        check('blank display name never falls back to login identifier')
        http('/api/v1/users/999999999', token=token, expected=40004)
        check('authenticated missing profile returns 404 business response')
        me = http('/api/v1/auth/me', token=token)
        assert me['username'] == 'sandbox_e2e' and me['email'] == 'sandbox@example.invalid'
        check('private me endpoint preserves own account details')
        challenge = http('/api/v1/captcha/image')
        admin_prefix = environment.get('ADMIN_API_PREFIX', '/api/admin/v1').strip('"\'')
        admin = http(admin_prefix + '/auth/login', {'username': 'secret_admin_login', 'password': password,
            'captchaId': challenge['captchaId'], 'captcha': redis('GET', 'oj:captcha:' + challenge['captchaId'])})['accessToken']
        result = http('/api/v1/users/' + str(other_id), token=admin)
        assert set(result) == public_keys
        check('administrator also receives minimal projection on public-profile API')
        detail = http(admin_prefix + '/users/' + str(other_id), token=admin)
        assert detail['username'] == private_login and detail['email'] == 'private@example.invalid'
        check('authorized management endpoint preserves administrative details')
        request = urllib.request.Request(base + admin_prefix + '/users/' + str(other_id),
            headers={'Authorization': 'Bearer ' + token})
        try:
            urllib.request.urlopen(request, timeout=15)
            raise AssertionError('Student read admin detail')
        except urllib.error.HTTPError as error:
            assert error.code in (403, 404), error.code
        check('ordinary student cannot read management details')
        leaderboard = http('/api/v1/leaderboard/global')
        assert private_login not in json.dumps(leaderboard) and 'secret_admin_login' not in json.dumps(leaderboard)
        check('public leaderboard does not expose seeded login identifiers')
        result = http('/api/v1/users/' + str(other_id), token=token)
        output_fixture = root / '.runtime/security-remediation/user-profile-fixture.json'
        output_fixture.write_text(json.dumps(result, ensure_ascii=False))
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
        output = root / '.runtime/security-remediation/user-profile-privacy-report.json'
        output.write_text(json.dumps({'passed': passed, 'checks': checks,
            'command': 'python3 tools/verify-user-profile-privacy-http.py',
            'scope': 'disposable local backend/database; no public target contacted'},
            ensure_ascii=False, indent=2))


if __name__ == '__main__':
    result = verify(Path(__file__).resolve().parents[1])
    print(json.dumps({'checks': len(result), 'passed': True}))
