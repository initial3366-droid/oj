"""Local HTTP E2E for recovery guards; requires Docker Redis and a running backend.

Failure cases: malformed codes accepted; missing codes accepted; alternating register/reset
bypasses budget; spoofed proxy headers bypass source limit; 429 lacks retry guidance.
Uses no real account, sends no email, and restores the local Redis source budget.
"""
import datetime
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('QOJ_HTTP_BASE', 'http://127.0.0.1:18080')
if not BASE.startswith(('http://127.0.0.1:', 'http://localhost:')):
    raise SystemExit('This verification is restricted to localhost')
ENV = dict(line.split('=', 1) for line in (ROOT / '.env').read_text().splitlines()
           if '=' in line and not line.lstrip().startswith('#'))
KEY = 'oj:auth:budget:recovery:source:127.0.0.1'
checks = []


def redis(*args):
    return subprocess.run(['docker', 'exec', '-e', 'REDISCLI_AUTH=' +
        ENV.get('REDIS_PASSWORD', 'qoj-redis-change-me-2026').strip('\"\''),
        'qoj-redis', 'redis-cli', '--raw', *map(str, args)],
        text=True, capture_output=True, check=True).stdout.strip()


def post(path, code):
    body = {'email': uuid.uuid4().hex + '@example.invalid',
            'username': 'guarduser', 'studentNo': '1234567890',
            'password': 'Example123!', 'newPassword': 'Example123!'}
    if code is not None:
        body['emailVerificationCode'] = code
    request = urllib.request.Request(BASE + '/api/v1/auth/' + path,
        data=json.dumps(body).encode(), headers={'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.' + str(len(checks) + 1)})
    try:
        response = urllib.request.urlopen(request, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, json.load(response), response.headers.get('Retry-After')


old, ttl = redis('GET', KEY), int(redis('PTTL', KEY))
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
try:
    redis('DEL', KEY)
    for path in ['reset-password', 'register']:
        for code in [None, '1', '1234567', 'abcdef', '１２３４５６']:
            status, body, _ = post(path, code)
            assert status == 400, (path, code, status)
            if code is not None:
                assert '6位数字' in body['message'], body['message']
            checks.append({'name': path + ': rejects ' + repr(code), 'status': status})
    redis('DEL', KEY)
    for index in range(20):
        status, _, _ = post('reset-password' if index % 2 else 'register', '000000')
        assert status == 400, (index, status)
    for path in ['reset-password', 'register']:
        status, _, retry = post(path, '000000')
        assert status == 429 and retry == '60', (status, retry)
        checks.append({'name': path + ': shared 20/min budget and spoof resistance',
                       'status': status, 'retryAfter': retry})
finally:
    if old and ttl > 0:
        redis('SET', KEY, old, 'PX', ttl)
    else:
        redis('DEL', KEY)
    output = ROOT / '.runtime/security-remediation/recovery-guard-report.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {'passed': len(checks) == 12, 'checks': checks, 'startedAt': started,
              'base': BASE, 'command': 'QOJ_HTTP_BASE=' + BASE + ' python3 tools/verify-recovery-guard-http.py'}
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'passed': report['passed'], 'report': str(output)}))
