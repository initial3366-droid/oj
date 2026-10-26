"""Local STOMP E2E: broker injection, exact SEND allowlist, native/SockJS and legitimate delivery.
Failure cases: cross-user injection; role bypass; alternate destinations; legal app sends or subscriptions broken.
Uses a disposable backend/database and empty Redis DB15; emits a repeatable JSON report.
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
import websocket


def verify(root):
    database = 'qoj_stomp_e2e_' + uuid.uuid4().hex[:8]
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
    log = (root / '.runtime/security-remediation/stomp-backend.log').open('w')
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
            assert process.poll() is None, 'Backend exited; inspect stomp-backend.log'
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
        def login(name, portal=''):
            challenge = http('/api/v1/captcha/image')
            return http('/api/' + (portal + '/v1' if portal else 'v1') + '/auth/login',
                {'username': name, 'password': password, 'captchaId': challenge['captchaId'],
                 'captcha': redis('GET', 'oj:captcha:' + challenge['captchaId'])})['accessToken']

        sql("INSERT INTO users(username,password_hash,role,display_name,email) VALUES('receiver','" + hashed + "','STUDENT','Receiver','receiver@example.invalid');")
        receiver_id = int(sql("SELECT id FROM users WHERE username='receiver';"))
        sql("INSERT INTO majors(code,name) VALUES('e2e','E2E');")
        tid = int(sql("INSERT INTO teachers(username,password_hash,display_name,major_id) VALUES('teacher','" + hashed + "','Teacher',(SELECT id FROM majors LIMIT 1)); SELECT LAST_INSERT_ID();"))
        sql("INSERT INTO admin_users(username,password_hash,role,display_name) VALUES('admin','" + hashed + "','SUPER_ADMIN','Admin');")
        tokens = {'STUDENT': token, 'TEACHER': login('teacher', 'teacher'), 'ADMIN': login('admin', 'auth_ac')}
        receiver_token = login('receiver')
        contest = int(sql(f"INSERT INTO contests(title,start_time,end_time,type,owner_id,owner_account_type,audience,status) VALUES('STOMP E2E',NOW()-INTERVAL 1 HOUR,NOW()+INTERVAL 1 HOUR,'ACM',{tid},'TEACHER','ALL','RUNNING'); SELECT LAST_INSERT_ID();"))
        sql(f"INSERT INTO contest_registrations(contest_id,user_id,identity_type,identity_id,status) VALUES({contest},{receiver_id},'USER',{receiver_id},'APPROVED');")
        sockets = []

        class Stomp:
            def __init__(self, access_token, sockjs=False):
                self.closed = False
                self.sockjs = sockjs
                self.buffer = ''
                self.pending = []
                path = '/ws-sockjs/000/' + uuid.uuid4().hex + '/websocket' if sockjs else '/ws'
                self.ws = websocket.create_connection(base.replace('http:', 'ws:') + path,
                    origin='http://127.0.0.1:5173', timeout=5)
                sockets.append(self.ws)
                if sockjs:
                    assert self.ws.recv() == 'o'
                self.send('CONNECT', {'accept-version': '1.2', 'host': 'localhost',
                    'heart-beat': '0,0', 'Authorization': 'Bearer ' + access_token})
                assert self.read().startswith('CONNECTED')

            def send(self, command, headers, body=''):
                frame = command + '\n' + '\n'.join(k + ':' + str(v) for k, v in headers.items()) + '\n\n' + body + '\x00'
                self.ws.send(json.dumps([frame]) if self.sockjs else frame)

            def read(self, timeout=5):
                deadline = time.monotonic() + timeout
                while time.monotonic() < deadline:
                    if '\x00' in self.buffer:
                        frame, self.buffer = self.buffer.split('\x00', 1)
                        if frame.strip():
                            return frame.lstrip('\n')
                    self.ws.settimeout(max(0.05, deadline - time.monotonic()))
                    try:
                        data = self.ws.recv()
                    except websocket.WebSocketTimeoutException:
                        return ''
                    except websocket.WebSocketConnectionClosedException:
                        self.closed = True
                        return ''
                    if not data:
                        self.closed = True
                        return ''
                    if self.sockjs:
                        if data.startswith('c'):
                            self.closed = True
                            return ''
                        if data.startswith('a'):
                            self.buffer += ''.join(json.loads(data[1:]))
                    else:
                        self.buffer += data.decode() if isinstance(data, bytes) else data
                return ''

            def subscribe(self, destination, sub_id):
                self.send('SUBSCRIBE', {'id': sub_id, 'destination': destination})

            def ready(self):
                self.send('SEND', {'destination': '/app/contest-messages/ready'}, '{}')
                frame = self.read()
                assert frame.startswith('MESSAGE') and '"ready":true' in frame, frame

        try:
            receiver = Stomp(receiver_token)
            receiver.subscribe('/user/queue/contest-message-acks', 'acks')
            receiver.subscribe('/user/queue/contest-messages', 'messages')
            destinations = ['/topic/submission-queue'] + [f'/topic/contests/{contest}/' + suffix
                for suffix in ['announcements', 'status', 'scoreboard']]
            for index, destination in enumerate(destinations):
                receiver.subscribe(destination, 'broker' + str(index))
            receiver.ready()
            checks.append({'name': 'legitimate subscriptions and ready acknowledgement', 'passed': True})
            for role, access_token in tokens.items():
                for destination in destinations:
                    attacker = Stomp(access_token)
                    marker = uuid.uuid4().hex
                    attacker.send('SEND', {'destination': destination}, json.dumps({'injection': marker}))
                    response = attacker.read()
                    assert response.startswith('ERROR') or attacker.closed, (role, destination, response)
                    assert marker not in receiver.read(0.15), 'Cross-user injection delivered'
                    attacker.ws.close()
                    checks.append({'name': role + ' cannot SEND ' + destination, 'passed': True,
                                   'response': 'ERROR' if response.startswith('ERROR') else 'CLOSED', 'crossUserDelivery': False})
            for destination in ['/queue/forged', '/user/queue/contest-messages',
                '/app/contest-messages/unknown', '/app/contest-messages/send/extra', '/topic', '/unknown']:
                attacker = Stomp(token)
                attacker.send('SEND', {'destination': destination}, '{}')
                assert attacker.read().startswith('ERROR') or attacker.closed, destination
                attacker.ws.close()
                checks.append({'name': 'default deny ' + destination, 'passed': True})
            fallback = Stomp(token, sockjs=True)
            fallback.send('SEND', {'destination': '/topic/submission-queue'}, '{}')
            assert fallback.read().startswith('ERROR') or fallback.closed
            checks.append({'name': 'SockJS also rejects direct broker SEND', 'passed': True})
            for role in ['STUDENT', 'TEACHER']:
                actor = Stomp(tokens[role])
                actor.subscribe('/user/queue/contest-message-acks', 'acks')
                actor.ready()
                content = 'controlled-' + role
                actor.send('SEND', {'destination': '/app/contest-messages/send', 'content-type': 'application/json'},
                    json.dumps({'contestId': contest, 'kind': 'BROADCAST',
                        'message': {'content': content, 'requestId': str(uuid.uuid4())}}))
                frame = actor.read()
                assert frame.startswith('MESSAGE'), frame
                if role == 'STUDENT':
                    assert '"code":403' in frame and sql('SELECT COUNT(*) FROM contest_messages;') == '0', frame
                    checks.append({'name': 'student broadcast denied by business authorization', 'passed': True})
                else:
                    assert '"code":200' in frame, frame
                    delivered = receiver.read()
                    assert content in delivered and 'BROADCAST' in delivered, delivered
                    assert sql('SELECT COUNT(*) FROM contest_messages;') == '1'
                    checks.append({'name': 'teacher owner broadcast persists and reaches registered student', 'passed': True})
            fallback = Stomp(receiver_token, sockjs=True)
            fallback.subscribe('/user/queue/contest-message-acks', 'acks')
            fallback.ready()
            checks.append({'name': 'SockJS legitimate ready remains functional', 'passed': True})
            return checks
        finally:
            for ws in sockets:
                ws.close()
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
        output = root / '.runtime/security-remediation/stomp-broker-report.json'
        output.write_text(json.dumps({'passed': len(checks) == 23, 'checks': checks,
            'command': 'python3 tools/verify-stomp-broker-http.py',
            'scope': 'disposable local backend, database and real native/SockJS STOMP connections'},
            ensure_ascii=False, indent=2))


if __name__ == '__main__':
    result = verify(Path(__file__).resolve().parents[1])
    print(json.dumps({'checks': len(result), 'passed': len(result) == 23}))
