"""Disposable business-API E2E against a real isolated worker (helper)."""
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
import threading
from concurrent.futures import ThreadPoolExecutor


def verify(root, worker_url, worker_token):
    database = 'qoj_sandbox_e2e_' + uuid.uuid4().hex[:8]
    environment = dict(line.split('=', 1) for line in (root / '.env').read_text().splitlines()
                       if '=' in line and not line.lstrip().startswith('#'))
    checks = []
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
    log = (root / '.runtime/security-remediation/sandbox-api-backend.log').open('w')
    try:
        sql('CREATE DATABASE ' + database + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;', 'qoj')
        created = True
        subprocess.run(['docker', 'exec', 'qoj-mysql', 'sh', '-c',
            'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysqldump -uroot --no-data --set-gtid-purged=OFF qoj | mysql -uroot ' + database],
            check=True, capture_output=True)
        sql('INSERT INTO flyway_schema_history SELECT * FROM qoj.flyway_schema_history;')
        sql("INSERT INTO system_settings(setting_key,setting_value,category) VALUES('judge.enable_sandbox','true','judge'),('judge.poll_interval_ms','200','judge');")
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        base = 'http://127.0.0.1:' + str(port)
        arguments = f'--server.port={port} --spring.datasource.url=jdbc:mysql://127.0.0.1:13306/{database}?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false'
        arguments += f' --spring.data.redis.database={redis_db} --qoj.jwt.secret={secrets.token_hex(32)} --qoj.go-judge.base-url={worker_url} --qoj.go-judge.auth-token={worker_token}'
        process = subprocess.Popen(['mvn', 'spring-boot:run', '-Dspring-boot.run.arguments=' + arguments],
            cwd=root / 'backend', stdout=log, stderr=log, start_new_session=True)

        def http(path, body=None, token=None, expected=200):
            request = urllib.request.Request(base + path,
                data=json.dumps(body).encode() if body is not None else None,
                headers={'Content-Type': 'application/json',
                         **({'Authorization': 'Bearer ' + token} if token else {})})
            try:
                response = urllib.request.urlopen(request, timeout=60)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                result = json.load(response)
            assert result['code'] == expected, result
            return result.get('data')

        for _ in range(120):
            assert process.poll() is None, 'Backend exited; inspect sandbox-api-backend.log'
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
        http('/api/v1/sandbox/run', {'language': 'python', 'code': 'print(42)', 'input': ''}, expected=401)
        checks.append({'name': 'business sandbox rejects anonymous execution', 'passed': True})
        result = http('/api/v1/sandbox/run', {'language': 'python', 'code': 'print(42)', 'input': ''}, token)
        assert result['status'] == 'AC' and result['output'] == '42\n', result
        checks.append({'name': 'business sandbox executes normal Python', 'passed': True})
        code = 'import ctypes;ctypes.CDLL(None).ptrace(0,0,0,0);print("UNSAFE")'
        result = http('/api/v1/sandbox/run', {'language': 'python', 'code': code, 'input': ''}, token)
        assert result['status'] == 'RE' and 'UNSAFE' not in result['output'], result
        checks.append({'name': 'business sandbox blocks dangerous syscall', 'passed': True})
        problem = int(sql(f"INSERT INTO problems(title,statement,time_limit,memory_limit,difficulty,owner_id,is_public,access_scope,student_publish_status) VALUES('Sandbox E2E','fixture',2000,256,1,{uid},1,'PUBLIC','PUBLISHED'); SELECT LAST_INSERT_ID();"))
        sql(f"INSERT INTO problem_test_cases(problem_id,case_no,input_data,output_data,sample) VALUES({problem},1,'','42',0);")
        for label, language, source, status in [
            ('normal', 'c', '#include <stdio.h>\nint main(){puts("42");}', 'AC'),
            ('dangerous', 'python', code, 'RE')]:
            sid = http('/api/v1/submissions', {'problemId': problem, 'language': language, 'code': source}, token)['id']
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                result = http('/api/v1/submissions/' + str(sid), token=token)
                if result['status'] not in ('WAITING', 'PENDING', 'JUDGING', 'COMPILING', 'RUNNING'):
                    break
                time.sleep(0.3)
            assert result['status'] == status, result
            checks.append({'name': 'business submission ' + label + ' finishes ' + status, 'passed': True})
        # Barrier-aligned bursts through the real business API and real worker.
        burst_tokens = []
        for index in range(3):
            name = 'burst' + str(index)
            sql("INSERT INTO users(username,password_hash,role,display_name,email) VALUES('" + name + "','" + hashed + "','STUDENT','Burst','" + name + "@example.invalid');")
            challenge = http('/api/v1/captcha/image')
            burst_tokens.append(http('/api/v1/auth/login', {'username': name, 'password': password,
                'captchaId': challenge['captchaId'], 'captcha': redis('GET', 'oj:captcha:' + challenge['captchaId'])})['accessToken'])
        for label, actors in [('same-user', [token] * 3), ('cross-user', burst_tokens)]:
            barrier = threading.Barrier(3)
            def burst(index):
                barrier.wait()
                source = 'print(41)' if index == 1 else 'print(42)'
                request = urllib.request.Request(base + '/api/v1/submissions',
                    data=json.dumps({'problemId': problem, 'language': 'python', 'code': source}).encode(),
                    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + actors[index]})
                try:
                    response = urllib.request.urlopen(request, timeout=30)
                except urllib.error.HTTPError as error:
                    response = error
                with response:
                    body = json.load(response)
                assert body['code'] in (200, 429), body
                return index, body
            with ThreadPoolExecutor(max_workers=3) as pool:
                responses = list(pool.map(burst, range(3)))
            accepted = [(index, body['data']['id']) for index, body in responses if body['code'] == 200]
            assert accepted and (label != 'cross-user' or len(accepted) == 3), responses
            outcomes = []
            for index, sid in accepted:
                deadline = time.monotonic() + 60
                while time.monotonic() < deadline:
                    result = http('/api/v1/submissions/' + str(sid), token=actors[index])
                    if result['status'] not in ('WAITING', 'PENDING', 'JUDGING', 'COMPILING', 'RUNNING'):
                        break
                    time.sleep(0.2)
                expected = 'WA' if index == 1 else 'AC'
                assert result['status'] == expected and len(result['cases']) == 1, result
                outcomes.append({'submissionId': sid, 'expected': expected, 'actual': result['status'], 'cases': 1})
            checks.append({'name': label + ' simultaneous burst preserves every accepted verdict', 'passed': True,
                           'accepted': len(accepted), 'rejected429': 3 - len(accepted), 'outcomes': outcomes})
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
