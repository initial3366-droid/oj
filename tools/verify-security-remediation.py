"""Local HTTP E2E. Requires QOJ, Docker MySQL/Redis and bcrypt; emits no credentials."""
from pathlib import Path
import base64
import bcrypt
import datetime
import json
import os
import secrets
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('QOJ_HTTP_BASE', 'http://127.0.0.1:18080')
OUT = ROOT / '.runtime/security-remediation'
OUT.mkdir(parents=True, exist_ok=True)
env = dict(line.split('=', 1) for line in (ROOT / '.env').read_text().splitlines()
           if '=' in line and not line.lstrip().startswith('#'))
run_id = 'sec' + uuid.uuid4().hex[:12]
checks = []
uids = []
tid = cid = contest = None
keys = set()
tokens = []


def sql(query):
    return subprocess.run(['docker', 'exec', '-i', 'qoj-mysql', 'sh', '-c',
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -B qoj'],
        input="SET time_zone='+08:00'; " + query, text=True, capture_output=True, check=True).stdout.strip()


def quote(value):
    return "CONVERT(0x" + str(value).encode().hex() + " USING utf8mb4) COLLATE utf8mb4_unicode_ci"


def redis(*args):
    return subprocess.run(['docker', 'exec', '-e', 'REDISCLI_AUTH=' +
        env.get('REDIS_PASSWORD', 'qoj-redis-change-me-2026').strip('"\''),
        'qoj-redis', 'redis-cli', '--raw', *map(str, args)], text=True,
        capture_output=True, check=True).stdout.strip()


def http(path, body=None, token=None, method=None, headers=None):
    request_headers = {'Content-Type': 'application/json', **(headers or {})}
    if token:
        request_headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=request_headers, method=method)
    try:
        response = urllib.request.urlopen(request, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, json.load(response)


def expect(response, code=200):
    status, data = response
    assert data.get('code') == code or (400 <= code < 600 and status == code), (status, data.get('code'), data.get('message'))
    return data.get('data')


def challenge():
    data = expect(http('/api/v1/captcha/image'))
    key = 'oj:captcha:' + data['captchaId']
    keys.add(key)
    return {'captchaId': data['captchaId'], 'captcha': redis('GET', key)}


def login(username, password, portal=''):
    result = expect(http('/api/' + (portal + '/v1' if portal else 'v1') + '/auth/login',
        {'username': username, 'password': password, **challenge()}))
    tokens.append(result)
    return result


def claims(token):
    part = token.split('.')[1]
    return json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))


def check(name):
    checks.append({'name': name, 'passed': True})


try:
    username = run_id
    email = run_id + '@example.invalid'
    password = secrets.token_hex(9)
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    uid = int(sql(f"INSERT INTO users(username,password_hash,role,display_name,email) VALUES({quote(username)},{quote(hashed)},'STUDENT','Security E2E',{quote(email)}); SELECT LAST_INSERT_ID();"))
    uids.append(uid)
    failkey = 'oj:auth:login-fail:source:127.0.0.1:' + username
    keys.add(failkey)
    expect(http('/api/v1/auth/login', {'username': username, 'password': password}), 400)
    check('login requires captcha')
    captcha = challenge()
    expect(http('/api/v1/auth/login', {'username': username, 'password': password,
        **captcha, 'captcha': 'incorrect'}), 400)
    expect(http('/api/v1/auth/login', {'username': username, 'password': password, **captcha}), 400)
    check('wrong image captcha consumes challenge')
    session = login(username, password)
    check('real login with single-use captcha')
    before = claims(session['refreshToken'])
    refreshed = expect(http('/api/v1/auth/refresh', {'refreshToken': session['refreshToken']}))
    tokens.append(refreshed)
    assert before['exp'] - before['iat'] == 28800
    assert claims(refreshed['refreshToken'])['sessionExpiresAt'] == before['sessionExpiresAt']
    check('refresh preserves eight-hour session deadline')
    new_password = secrets.token_hex(9)
    expect(http('/api/v1/auth/password', {'oldPassword': password, 'newPassword': new_password},
        session['accessToken'], 'PUT'))
    expect(http('/api/v1/auth/me', token=refreshed['accessToken']), 401)
    expect(http('/api/v1/auth/refresh', {'refreshToken': refreshed['refreshToken']}), 401)
    check('password change rejects old access and refresh tokens')
    password = new_password
    session = login(username, password)
    codekey = 'oj:email:verify:' + email
    keys.update([codekey, codekey + ':attempts'])
    redis('SET', codekey, '654321', 'EX', 600)
    for _ in range(5):
        expect(http('/api/v1/auth/reset-password', {'email': email,
            'emailVerificationCode': '000000', 'newPassword': password}), 400)
    assert redis('EXISTS', codekey) == '0'
    expect(http('/api/v1/auth/reset-password', {'email': email,
        'emailVerificationCode': '654321', 'newPassword': password}), 400)
    check('five wrong email codes invalidate even the correct code')
    redis('SET', codekey, '654321', 'EX', 600)
    reset_body = {'email': email, 'emailVerificationCode': '654321', 'newPassword': secrets.token_hex(9)}
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: http('/api/v1/auth/reset-password', reset_body), range(2)))
    assert sorted(data['code'] for _, data in responses) == [200, 400]
    expect(http('/api/v1/auth/me', token=session['accessToken']), 401)
    check('email reset is atomically single-use and revokes tokens')
    password = reset_body['newPassword']
    session = login(username, password)
    major = int(sql('SELECT id FROM majors LIMIT 1;'))
    teacher_name = run_id + 't'
    tid = int(sql(f"INSERT INTO teachers(username,password_hash,display_name,major_id) VALUES({quote(teacher_name)},{quote(hashed)},'Security E2E',{major}); SELECT LAST_INSERT_ID();"))
    keys.add('oj:auth:login-fail:source:127.0.0.1:' + teacher_name)
    expect(http('/api/v1/auth/login', {'username': teacher_name, 'password': reset_body['newPassword'], **challenge()}), 40001)
    check('frontend does not authenticate teacher credentials or redirect by password')
    # The initial hash belongs to the first password; use a fresh known teacher credential.
    teacher_password = secrets.token_hex(9)
    teacher_hash = bcrypt.hashpw(teacher_password.encode(), bcrypt.gensalt()).decode()
    sql(f'UPDATE teachers SET password_hash={quote(teacher_hash)} WHERE id={tid};')
    teacher = login(teacher_name, teacher_password, 'teacher')
    teacher_claims = claims(teacher['refreshToken'])
    assert teacher_claims['exp'] - teacher_claims['iat'] == 28800
    expect(http('/api/v1/auth/login', {'username': teacher_name, 'password': teacher_password, **challenge()}), 40001)
    check('teacher login uses correct portal and fixed eight-hour session')
    cid = int(sql('SELECT COALESCE(MAX(id),0)+1 FROM classes;'))
    sql(f"INSERT INTO classes(id,name,teacher_id) VALUES({cid},{quote(run_id)},{tid});")
    student_no = run_id + 'student'
    imported = expect(http('/api/teacher/v1/students/import', {'classId': cid,
        'studentNoField': 'studentNo', 'nameField': 'name', 'fields': ['studentNo', 'name'],
        'rows': [{'studentNo': student_no, 'name': 'Security imported'}]}, teacher['accessToken']))
    assert imported['successCount'] == 1, imported.get('errors')
    initial = imported['successes'][0]['initialPassword']
    assert len(initial) == 20 and initial != student_no[-6:]
    imported_uid = int(sql(f'SELECT id FROM users WHERE username={quote(student_no)};'))
    uids.append(imported_uid)
    keys.add('oj:auth:login-fail:source:127.0.0.1:' + student_no)
    login(student_no, initial)
    again = expect(http('/api/teacher/v1/students/import', {'classId': cid,
        'studentNoField': 'studentNo', 'nameField': 'name', 'fields': ['studentNo', 'name'],
        'rows': [{'studentNo': student_no, 'name': 'Security imported'}]}, teacher['accessToken']))
    assert not again['successes'][0].get('initialPassword')
    login(student_no, initial)
    check('import returns a usable random password once and preserves existing credentials')
    weak_hash = bcrypt.hashpw(student_no[-6:].encode(), bcrypt.gensalt()).decode()
    sql(f'UPDATE users SET password_hash={quote(weak_hash)} WHERE id={imported_uid};')
    expect(http('/api/v1/auth/login', {'username': student_no, 'password': student_no[-6:], **challenge()}), 403)
    sql(f'DELETE FROM class_members WHERE user_id={imported_uid};')
    expect(http('/api/v1/auth/login', {'username': student_no, 'password': student_no[-6:], **challenge()}), 403)
    check('historical last-six password is disabled even after import membership is removed')
    contest = int(sql(f"INSERT INTO contests(title,start_time,end_time,freeze_time,frozen,type,owner_id,owner_account_type,audience,status) VALUES({quote(run_id)},NOW()-INTERVAL 2 HOUR,NOW()+INTERVAL 1 HOUR,NOW()-INTERVAL 1 HOUR,1,'ACM',{tid},'TEACHER','PUBLIC','RUNNING'); SELECT LAST_INSERT_ID();"))
    sql(f"INSERT INTO contest_registrations(contest_id,user_id,identity_type,identity_id,status) VALUES({contest},{uid},'USER',{uid},'APPROVED');")
    for suffix in ['/rank', '/scoreboard/snapshot/final', '/scoreboard/snapshot/%20FiNaL%20']:
        expect(http(f'/api/v1/contests/{contest}' + suffix, token=session['accessToken']), 403)
    expect(http(f'/api/v1/contests/{contest}/rank'), 403)
    expect(http(f'/api/v1/contests/{contest}/scoreboard', token=session['accessToken']))
    check('frozen raw rank and normalized final snapshots denied; regular scoreboard works')
    # Force only this local source budget over its limit; restore its prior value afterwards.
    budget_key = 'oj:auth:budget:login:source:127.0.0.1'
    old, ttl = redis('GET', budget_key), int(redis('TTL', budget_key))
    try:
        redis('SET', budget_key, '120', 'EX', 60)
        response = http('/api/v1/auth/login', {'username': username, 'password': password},
            headers={'X-Forwarded-For': '198.51.100.22'})
        expect(response, 429)
        assert response[0] == 429
    finally:
        if old and ttl > 0:
            redis('SET', budget_key, old, 'EX', ttl)
        else:
            redis('DEL', budget_key)
    check('source budget rejects spoofed forwarded address')
finally:
    if contest:
        sql(f'DELETE FROM contest_registrations WHERE contest_id={contest}; DELETE FROM contests WHERE id={contest};')
    if cid:
        imported_users = sql(f'SELECT id FROM users WHERE class_id={cid};')
        for imported_id in imported_users.splitlines():
            if int(imported_id) not in uids:
                uids.append(int(imported_id))
        sql(f'DELETE FROM class_members WHERE class_id={cid}; UPDATE users SET class_id=NULL WHERE class_id={cid}; DELETE FROM classes WHERE id={cid};')
    if tid:
        sql(f'DELETE FROM teachers WHERE id={tid};')
    for uid in uids:
        sql(f'DELETE FROM user_scores WHERE user_id={uid}; DELETE FROM users WHERE id={uid};')
        keys.update(['oj:online:' + str(uid), 'oj:online:user:' + str(uid)])
    if tid:
        keys.add('oj:online:teacher:' + str(tid))
    for token in tokens:
        family = claims(token['refreshToken']).get('familyId')
        if family:
            keys.update(redis('KEYS', '*'+family+'*').splitlines())
        for kind in ['accessToken', 'refreshToken']:
            jti = claims(token[kind])['jti']
            keys.update(['oj:token:blacklist:' + jti, 'oj:refresh:blacklist:' + jti])
    if keys:
        redis('DEL', *keys)
    report = {'passed': len(checks) == 13, 'checks': checks, 'temporaryDataRemoved': True,
        'timestamp': datetime.datetime.now().isoformat(), 'command': 'python3 tools/verify-security-remediation.py'}
    (OUT / 'http-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'passed': report['passed'], 'checks': len(checks), 'report': str(OUT / 'http-report.json')}))
