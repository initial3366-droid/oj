"""Real HTTP E2E for minimal submission responses in a disposable database.
Failure cases: extra fields/login identifiers, blank display fallback, filters,
existing practice code sharing, anonymous detail, contest result masking,
and privileged management fields leaking into the public endpoint.
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
    database = 'qoj_submission_privacy_' + uuid.uuid4().hex[:8]
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
    log = (root / '.runtime/submission-privacy/backend.log').open('w')
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
            assert process.poll() is None, 'Backend exited; inspect backend.log'
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
        other=int(sql("INSERT INTO users(username,password_hash,role,display_name,email) VALUES('hidden_login_other','"+hashed+"','STUDENT','','other@example.invalid'); SELECT LAST_INSERT_ID();"))
        pid=int(sql(f"INSERT INTO problems(title,statement,time_limit,memory_limit,difficulty,owner_id,is_public,access_scope,student_publish_status) VALUES('Privacy fixture','fixture',1000,256,1,{uid},1,'ALL','PUBLISHED'); SELECT LAST_INSERT_ID();"))
        sid=int(sql(f"INSERT INTO submissions(user_id,problem_id,code,code_length,language,status,time_used,memory_used,identity_type,identity_id,submit_time) VALUES({uid},{pid},'secret source',13,'cpp17','AC',12,2048,'PERSONAL',987654,NOW()); SELECT LAST_INSERT_ID();"))
        other_sid=int(sql(f"INSERT INTO submissions(user_id,problem_id,code,code_length,language,status,time_used,memory_used,identity_type,identity_id) VALUES({other},{pid},'other secret',12,'python','WA',30,4096,'PERSONAL',123456); SELECT LAST_INSERT_ID();"))
        allowed={'id','userId','displayName','problemId','problemTitle','language','status','timeUsed','memoryUsed','createdAt','codeLength','passedCaseCount','totalCaseCount'}
        forbidden={'username','identityType','identityId','contestId','practiceId','submitTime','code','cases'}
        def check(name): checks.append({'name':name,'passed':True})
        def validate(result):
            assert result['total']>=1
            for item in result['list']:
                assert set(item)==allowed, set(item)
                assert not (set(item)&forbidden)
                assert all(secret not in json.dumps(item) for secret in ['hidden_login_other','sandbox_e2e','secret source','other secret','987654','123456'])
            return result
        public=validate(http('/api/v1/submissions'))
        check('anonymous list has exact minimal field allowlist and no login/code/internal identities')
        owner=validate(http('/api/v1/submissions?userId='+str(uid),token=token))
        assert owner['total']==1 and owner['list'][0]['id']==sid
        check('own-user list remains minimal and user filter works')
        public_other=next(x for x in public['list'] if x['id']==other_sid)
        assert public_other['displayName']=='用户'
        check('blank display name never falls back to login name')
        row=owner['list'][0]
        assert row['status']=='AC' and row['timeUsed']==12 and row['memoryUsed']==2048 and row['createdAt']
        check('verdict/resources and single submission timestamp remain usable')
        page=validate(http('/api/v1/submissions?page=1&pageSize=1'))
        assert len(page['list'])==1 and page['total']==2
        check('pagination preserves total and page size')
        result=validate(http(f'/api/v1/submissions?problemId={pid}&language=cpp17&status=AC'))
        assert len(result['list'])==1 and result['list'][0]['id']==sid
        check('problem/language/status filters remain functional')
        detail=http('/api/v1/submissions/'+str(sid),token=token)
        assert detail['code']=='secret source'
        assert set(detail)==allowed|{'code','cases'}
        check('authorized own detail still contains source code')
        other_detail=http('/api/v1/submissions/'+str(other_sid),token=token)
        assert other_detail['code']=='other secret'
        assert not (set(other_detail)&{'username','identityType','identityId','contestId','practiceId','submitTime'})
        check('existing practice code sharing remains usable without login/internal fields')
        http('/api/v1/submissions/'+str(sid),expected=401)
        check('anonymous cannot fetch submission detail')
        sql("INSERT INTO admin_users(username,password_hash,role,display_name) VALUES('privacy_admin','"+hashed+"','SUPER_ADMIN','Admin');")
        challenge=http('/api/v1/captcha/image')
        prefix=environment.get('ADMIN_API_PREFIX','/api/admin/v1').strip(chr(34)+chr(39))
        admin=http(prefix+'/auth/login',{'username':'privacy_admin','password':password,'captchaId':challenge['captchaId'],
            'captcha':redis('GET','oj:captcha:'+challenge['captchaId'])})['accessToken']
        validate(http('/api/v1/submissions',token=admin))
        check('public endpoint stays minimal even for administrator')
        management=http(prefix+'/submissions',token=admin)
        assert any(row.get('username')=='hidden_login_other' for row in management['list'])
        check('authorized management response preserves its administrative fields')
        # A contest owned by the other user hides their status from this student.
        contest=int(sql(f"INSERT INTO contests(title,start_time,end_time,type,owner_id,audience,status,allow_view_all_submissions) VALUES('Private results',NOW()-INTERVAL 1 HOUR,NOW()+INTERVAL 1 HOUR,'ACM',{other},'ALL','RUNNING',0); SELECT LAST_INSERT_ID();"))
        contest_sid=int(sql(f"INSERT INTO submissions(user_id,problem_id,contest_id,code,code_length,language,status,time_used,memory_used,identity_type,identity_id) VALUES({other},{pid},{contest},'hidden contest source',21,'cpp17','AC',50,8192,'PERSONAL',555555); SELECT LAST_INSERT_ID();"))
        http('/api/v1/submissions/'+str(contest_sid),token=token,expected=40003)
        check('other-user active contest detail remains forbidden')
        contest_list=validate(http('/api/v1/submissions?contestId='+str(contest),token=token))
        hidden=next(x for x in contest_list['list'] if x['id']==contest_sid)
        assert hidden['status']=='PENDING'
        assert all(hidden[x] is None for x in ['timeUsed','memoryUsed','codeLength','passedCaseCount','totalCaseCount'])
        check('hidden contest verdict masks resources and result statistics')
        admin_contest=validate(http('/api/v1/submissions?contestId='+str(contest),token=admin))
        assert admin_contest['list'][0]['status']=='AC'
        check('contest manager can still see actual verdict through minimal response')
        (root/'.runtime/submission-privacy/list-fixture.json').write_text(json.dumps(public,ensure_ascii=False,indent=2))
        passed=True
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
        output = root / '.runtime/submission-privacy/http-report.json'
        output.write_text(json.dumps({'passed': passed, 'checks': checks,
            'command': 'python3 tools/verify-submission-list-privacy-http.py',
            'scope': 'disposable local backend/database; no public target contacted'},
            ensure_ascii=False, indent=2))


if __name__ == '__main__':
    result = verify(Path(__file__).resolve().parents[1])
    print(json.dumps({'checks': len(result), 'passed': True}))
