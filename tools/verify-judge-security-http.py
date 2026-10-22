"""Disposable DB + real backend HTTP + controlled local sandbox; never runs user code."""
from pathlib import Path
import bcrypt
import base64
import hashlib
import hmac
import json
import os
import secrets
import signal
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.runtime/security-remediation'
OUT.mkdir(parents=True, exist_ok=True)
DB = 'qoj_security_e2e_' + uuid.uuid4().hex[:8]
JUDGE_TOKEN = secrets.token_hex(24)
JWT_SECRET = secrets.token_hex(32)
BASE = 'http://127.0.0.1:18081'
environment = dict(line.split('=', 1) for line in (ROOT / '.env').read_text().splitlines()
                   if '=' in line and not line.lstrip().startswith('#'))
checks, requests, deleted = [], [], []
redis_keys, sessions = set(), []
mode = 'fast'
started = threading.Event()
backend = None
created = False


def sql(query, database=DB):
    return subprocess.run(['docker', 'exec', '-i', 'qoj-mysql', 'sh', '-c',
        f'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -B {database}'],
        input="SET time_zone='+08:00'; " + query, text=True, capture_output=True, check=True).stdout.strip()


def redis(*args):
    if args and args[0] in ('GET', 'SET') and len(args) > 1:
        redis_keys.add(str(args[1]))
    return subprocess.run(['docker', 'exec', '-e', 'REDISCLI_AUTH=' +
        environment.get('REDIS_PASSWORD', 'qoj-redis-change-me-2026').strip('"\''),
        'qoj-redis', 'redis-cli', '-n', '14', '--raw', *map(str, args)],
        text=True, capture_output=True, check=True).stdout.strip()


def http(path, body=None, token=None, expected=200):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    try:
        response = urllib.request.urlopen(urllib.request.Request(BASE + path,
            data=json.dumps(body).encode() if body is not None else None, headers=headers), timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        result = json.load(response)
    assert result['code'] == expected, (result.get('code'), result.get('message'))
    return result.get('data')


class Sandbox(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_DELETE(self):
        deleted.append(self.path)
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        assert self.headers.get('Authorization') == 'Bearer ' + JUDGE_TOKEN
        command = json.loads(self.rfile.read(int(self.headers['Content-Length'])))['cmd'][0]
        compiler = bool(command.get('copyOutCached'))
        entry = {'mode': mode, 'compiler': compiler, 'clockLimit': command['clockLimit'], 'at': time.monotonic()}
        requests.append(entry)
        if not compiler:
            started.set()
            if mode == 'slow':
                time.sleep(0.9)
            elif mode == 'heartbeat':
                time.sleep(5.5)
            elif mode == 'body-stall':
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.flush()
                time.sleep(8)
                return
        file_ids = {name: 'fixture-' + uuid.uuid4().hex for name in command.get('copyOutCached', [])}
        data = json.dumps([{'status': 'Accepted', 'exitStatus': 0, 'time': 1000000,
            'memory': 1048576, 'files': {'stdout': 'ok', 'stderr': ''}, 'fileIds': file_ids}]).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass


def await_value(query, predicate, seconds=15):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        value = sql(query)
        if predicate(value):
            return value
        time.sleep(0.1)
    raise AssertionError('Database state did not converge: ' + value)


def submit(problem, token):
    started.clear()
    return http('/api/v1/submissions', {'problemId': problem, 'code': 'int main() {return 0;}',
        'language': 'cpp17'}, token)['id']


def finished(submission, token):
    await_value(f'SELECT status FROM submissions WHERE id={submission};',
        lambda value: value not in ('WAITING', 'PENDING', 'JUDGING', 'COMPILING', 'RUNNING'))
    return http(f'/api/v1/submissions/{submission}', token=token)


sandbox = ThreadingHTTPServer(('127.0.0.1', 0), Sandbox)
threading.Thread(target=sandbox.serve_forever, daemon=True).start()
log = (OUT / 'judge-backend.log').open('w')
try:
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        backend_port = probe.getsockname()[1]
    BASE = f'http://127.0.0.1:{backend_port}'
    sql(f'CREATE DATABASE {DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;', 'qoj')
    created = True
    subprocess.run(['docker', 'exec', 'qoj-mysql', 'sh', '-c',
        f'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysqldump -uroot --no-data --set-gtid-purged=OFF qoj | mysql -uroot {DB}'],
        check=True, capture_output=True)
    sql('INSERT INTO flyway_schema_history SELECT * FROM qoj.flyway_schema_history;')
    sql("INSERT INTO system_settings(setting_key,setting_value,category) VALUES ('judge.poll_interval_ms','200','judge'),('judge.stale_task_minutes','2','judge');")
    args = f'--server.port={backend_port} --spring.datasource.url=jdbc:mysql://127.0.0.1:13306/' + DB + '?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false'
    args += f' --spring.data.redis.database=14 --qoj.jwt.secret={JWT_SECRET} --qoj.go-judge.base-url=http://127.0.0.1:{sandbox.server_port} --qoj.go-judge.auth-token={JUDGE_TOKEN} --qoj.go-judge.max-submission-time-ms=6000'
    backend = subprocess.Popen(['mvn', 'spring-boot:run', '-Dspring-boot.run.arguments=' + args],
        cwd=ROOT / 'backend', stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(120):
        if backend.poll() is not None:
            raise AssertionError('Backend exited; inspect judge-backend.log')
        try:
            captcha = http('/api/v1/captcha/image')
            break
        except (OSError, AssertionError):
            time.sleep(0.5)
    else:
        raise AssertionError('Backend startup timed out')
    password = secrets.token_hex(9)
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    uid = int(sql(f"INSERT INTO users(username,password_hash,role,display_name,email) VALUES('judge_e2e','{hashed}','STUDENT','Judge E2E','judge@example.invalid'); SELECT LAST_INSERT_ID();"))
    session = http('/api/v1/auth/login', {'username': 'judge_e2e', 'password': password,
        'captchaId': captcha['captchaId'], 'captcha': redis('GET', 'oj:captcha:' + captcha['captchaId'])})
    token = session['accessToken']
    sessions.append(session)
    redis_keys.update(['oj:online:' + str(uid), 'oj:online:user:' + str(uid)])
    def old_format(encoded):
        header, payload, _ = encoded.split('.')
        data = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        data.pop('credential', None)
        payload = base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip('=')
        signed = header + '.' + payload
        signature = hmac.new(JWT_SECRET.encode(), signed.encode(), hashlib.sha512).digest()
        return signed + '.' + base64.urlsafe_b64encode(signature).decode().rstrip('=')
    http('/api/v1/auth/me', token=old_format(token), expected=401)
    http('/api/v1/auth/refresh', {'refreshToken': old_format(session['refreshToken'])}, expected=401)
    checks.append({'name': 'correctly signed legacy tokens without credential claim are rejected', 'passed': True})
    email = DB + '@example.invalid'
    code_key = 'oj:email:verify:' + email
    mail_config = json.dumps({'host': '127.0.0.1', 'port': 1, 'username': 'fixture@example.invalid', 'password': 'fixture', 'useSsl': False})
    sql(f"INSERT INTO system_settings(setting_key,setting_value,category) VALUES('register.email_config','{mail_config}','register');")
    redis('SET', code_key, '654321', 'EX', 600)
    mail_bodies = []
    for _ in range(2):
        challenge = http('/api/v1/captcha/image')
        mail_bodies.append({'email': email, 'captchaId': challenge['captchaId'],
            'captcha': redis('GET', 'oj:captcha:' + challenge['captchaId'])})
    def send_mail(body):
        try:
            http('/api/v1/captcha/email', body, expected=500)
            return 500
        except AssertionError as error:
            assert error.args[0][0] == 429, error
            return 429
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(send_mail, mail_bodies))
    assert sorted(statuses) == [429, 500] and redis('EXISTS', code_key) == '0'
    redis_keys.update(['oj:email:rate:' + email, 'oj:email:daily:' + email + ':' + time.strftime('%Y-%m-%d'), code_key + ':attempts'])
    checks.append({'name': 'concurrent sends reserve one quota; SMTP failure leaves no live code', 'passed': True})
    redis('SET', code_key, '654321', 'EX', 600)
    registration = http('/api/v1/auth/register', {'username': 'reg' + uuid.uuid4().hex[:10],
        'studentNo': '9988776655', 'email': email, 'password': secrets.token_hex(9), 'emailVerificationCode': '654321'})
    sessions.append(registration)
    payload = registration['refreshToken'].split('.')[1]
    registered_claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
    assert registered_claims['exp'] - registered_claims['iat'] == 28800
    assert redis('EXISTS', code_key) == '0'
    redis_keys.update(['oj:online:' + str(registered_claims['userId']), 'oj:online:user:' + str(registered_claims['userId'])])
    checks.append({'name': 'registration consumes the shared email code and issues a fixed eight-hour session', 'passed': True})
    problem = int(sql(f"INSERT INTO problems(title,statement,time_limit,memory_limit,difficulty,owner_id,is_public,access_scope,student_publish_status) VALUES('Security judge E2E','fixture',10000,256,1,{uid},1,'PUBLIC','PUBLISHED'); SELECT LAST_INSERT_ID();"))
    for case in range(1, 9):
        sql(f"INSERT INTO problem_test_cases(problem_id,case_no,input_data,output_data,sample) VALUES({problem},{case},'input','ok',0);")
    submission = submit(problem, token)
    assert finished(submission, token)['status'] == 'AC'
    checks.append({'name': 'normal HTTP submission executes all eight cases', 'passed': True})
    mode = 'slow'
    start = time.monotonic()
    submission = submit(problem, token)
    result = finished(submission, token)
    elapsed = time.monotonic() - start
    assert result['status'] == 'TLE' and len(result['cases']) == 8, result['status']
    score = int(sql(f'SELECT score FROM submissions WHERE id={submission};'))
    assert 0 < score < 100 and elapsed < 9, (score, elapsed)
    clocks = [item['clockLimit'] for item in requests if item['mode'] == 'slow']
    assert all(0 < value <= 6000000000 for value in clocks) and clocks[-1] < clocks[0]
    checks.append({'name': 'aggregate deadline preserves partial score and all case rows', 'passed': True, 'elapsedSeconds': round(elapsed, 2), 'score': score})
    mode = 'body-stall'
    start = time.monotonic()
    submission = submit(problem, token)
    assert finished(submission, token)['status'] == 'TLE'
    elapsed = time.monotonic() - start
    assert elapsed < 9, elapsed
    checks.append({'name': 'response body stall obeys total execution deadline', 'passed': True, 'elapsedSeconds': round(elapsed, 2)})
    sql(f'DELETE FROM problem_test_cases WHERE problem_id={problem} AND case_no>1;')
    mode = 'heartbeat'
    submission = submit(problem, token)
    assert started.wait(5)
    owner = sql(f'SELECT judge_worker_id FROM submissions WHERE id={submission};')
    sql(f"UPDATE submissions SET judge_start_time=NOW()-INTERVAL 30 MINUTE,updated_at=NOW()-INTERVAL 10 SECOND WHERE id={submission};")
    await_value(f'SELECT TIMESTAMPDIFF(SECOND,updated_at,NOW()) FROM submissions WHERE id={submission};', lambda value: int(value) < 3, 5.3)
    assert sql(f'SELECT judge_worker_id FROM submissions WHERE id={submission};') == owner
    assert finished(submission, token)['status'] == 'AC'
    checks.append({'name': 'live lease renews without recycling an old start timestamp', 'passed': True})
    mode = 'fast'
    stale = int(sql(f"INSERT INTO submissions(user_id,problem_id,code,language,status,judge_server,judge_worker_id,judge_start_time,updated_at,retry_count) VALUES({uid},{problem},'fixture','cpp17','JUDGING','GO_JUDGE','dead-worker',NOW()-INTERVAL 1 HOUR,NOW()-INTERVAL 1 HOUR,3); SELECT LAST_INSERT_ID();"))
    await_value(f'SELECT status FROM submissions WHERE id={stale};', lambda value: value == 'SE')
    assert sql(f'SELECT retry_count FROM submissions WHERE id={stale};') == '3'
    checks.append({'name': 'exhausted recovery becomes terminal instead of requeuing', 'passed': True})
    recovered = int(sql(f"INSERT INTO submissions(user_id,problem_id,code,language,status,judge_server,judge_worker_id,judge_start_time,updated_at,retry_count) VALUES({uid},{problem},'fixture','cpp17','JUDGING','GO_JUDGE','dead-worker',NOW()-INTERVAL 1 HOUR,NOW()-INTERVAL 1 HOUR,0); SELECT LAST_INSERT_ID();"))
    assert finished(recovered, token)['status'] == 'AC'
    assert sql(f'SELECT retry_count FROM submissions WHERE id={recovered};') == '1'
    assert deleted
    checks.append({'name': 'expired lease recovers once and compiler artifacts are deleted', 'passed': True})
finally:
    if backend and backend.poll() is None:
        os.killpg(backend.pid, signal.SIGTERM)
        try:
            backend.wait(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(backend.pid, signal.SIGKILL)
            backend.wait(timeout=5)
    sandbox.shutdown()
    sandbox.server_close()
    log.close()
    if created:
        sql(f'DROP DATABASE {DB};', 'qoj')
    for item in sessions:
        for encoded in [item['accessToken'], item['refreshToken']]:
            payload = encoded.split('.')[1]
            data = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
            redis_keys.update(['oj:token:blacklist:' + data['jti'], 'oj:refresh:blacklist:' + data['jti']])
            if data.get('familyId'):
                redis_keys.add('oj:refresh:family:' + data['familyId'])
    if redis_keys:
        redis('DEL', *redis_keys)
    report = {'passed': len(checks) == 9, 'checks': checks, 'sandboxRequests': requests,
        'cachedArtifactsDeleted': len(deleted), 'isolatedDatabaseRemoved': created,
        'command': 'python3 tools/verify-judge-security-http.py'}
    (OUT / 'judge-http-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'passed': report['passed'], 'checks': len(checks), 'report': str(OUT / 'judge-http-report.json')}))
