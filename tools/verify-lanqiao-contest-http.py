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
import websocket


def verify(root):
    output = root / os.environ.get('QOJ_E2E_OUTPUT', 'artifacts/lanqiao')
    output.mkdir(parents=True, exist_ok=True)
    database = 'qoj_lanqiao_' + uuid.uuid4().hex[:8]
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
    log = (output / 'backend.log').open('w')
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

        def http(path, body=None, token=None, expected=200, headers=None, method=None):
            request = urllib.request.Request(base + path, method=method,
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
        # Lanqiao coverage uses real HTTP against the disposable application.
        def update(cid, patch, actor=admin):
            return http(prefix+'/contests/'+str(cid), patch, actor, method='PUT')
        def create(kind='LANQIAO', actor=admin, **extra):
            payload={'title':'Lanqiao E2E '+kind, 'startTime':'2026-01-01T00:00:00',
                'endTime':'2099-01-01T00:00:00','type':kind,'audience':'ALL',
                'problems':[{'problemId':x,'label':chr(65+i),'displayOrder':i+1} for i,x in enumerate(problem_ids)],**extra}
            return http(prefix+'/contests',payload,actor)
        problem_ids=[pid]
        for i in range(2):
            problem_ids.append(int(sql(f"INSERT INTO problems(title,statement,time_limit,memory_limit,difficulty,owner_id,is_public,access_scope,student_publish_status) VALUES('Equal {i}','fixture',1000,256,1,{uid},1,'ALL','PUBLISHED'); SELECT LAST_INSERT_ID();")))
        for problem_id in problem_ids:
            for case in range(1,4):
                sql(f"INSERT INTO problem_test_cases(problem_id,case_no,input_data,output_data,sample) VALUES({problem_id},{case},'1','1',0);")
        lane=create()
        cid=lane['id']
        assert lane['type']=='LANQIAO' and lane['scoreboardEnabled'] is False and lane['resultsPublished'] is False
        assert lane['publicScoreboardEnabled'] is False
        check('Lanqiao defaults: internal board off, external board off, results unpublished')
        cps=http(prefix+f'/contests/{cid}/problems',token=admin)
        assert [x['score'] for x in cps]==[34,33,33],cps
        assert [x['score'] for x in cps[0]['caseScores']]==[12,11,11],cps
        check('backend default 100 points splits 34/33/33 and test cases 12/11/11')
        oi=create('OI')
        assert oi['scoreboardEnabled'] is True
        oi_problems=http(prefix+f"/contests/{oi['id']}/problems",token=admin)
        assert sum(x['score'] for x in oi_problems)==100
        check('OI defaults to 100 total with equal integer allocation')
        http(f'/api/v1/contests/{cid}/register',{'identityType':'PERSONAL'},token)
        for path in [f'/api/v1/contests/{cid}/scoreboard',f'/api/v1/contests/{cid}/rank',f'/api/v1/contests/{cid}/scoreboard/snapshot/FINAL',f'/api/v1/contests/public/{cid}/scoreboard']:
            http(path,token=token,expected=40003)
        check('closed internal/rank/snapshot/external board routes deny student')
        update(cid,{'scoreboardEnabled':True,'publicScoreboardEnabled':True})
        http(f'/api/v1/contests/{cid}/scoreboard',token=token,expected=40003)
        http(f'/api/v1/contests/public/{cid}/scoreboard',expected=40003)
        http(prefix+f'/contests/{cid}',{'resultsPublished':True},admin,expected=400,method='PUT')
        check('enabling boards never leaks running contest scores; early publication rejected')
        receipt=http('/api/v1/submissions',{'problemId':cps[0]['contestProblemId'] if 'contestProblemId' in cps[0] else cps[0]['id'],
            'contestId':cid,'language':'cpp17','code':'int main(){return 0;}'},token)
        assert receipt['status']=='SUBMITTED',receipt
        receipt_id=receipt['id']
        for status in ['AC','WA','CE','TLE','SE']:
            sql(f"UPDATE submissions SET status='{status}',score=34,time_used=99,memory_used=9999 WHERE id={receipt_id};")
            detail=http('/api/v1/submissions/'+str(receipt_id),token=token)
            assert detail['status']=='SUBMITTED' and detail['cases']==[]
            assert all(detail[x] is None for x in ['timeUsed','memoryUsed','passedCaseCount','totalCaseCount'])
            assert detail['code']=='int main(){return 0;}'
        check('real submission receives success only; AC/WA/CE/TLE/SE detail projections hide metrics/cases and retain own code')
        page=http(f'/api/v1/submissions?contestId={cid}&userId={uid}&status=AC',token=token)
        assert page['total']==1 and page['list'][0]['status']=='SUBMITTED'
        assert http(f'/api/v1/contests/{cid}/my-accepted-problems',token=token)==[]
        assert all(x['acceptedCount']==0 for x in http(f'/api/v1/contests/{cid}',token=token)['problems'])
        check('status filter, accepted-problem list and problem acceptance statistics do not reveal verdicts')
        # Last submission has 0 points; earlier accepted submission must never win.
        sql(f"UPDATE submissions SET status='AC',score=34,submit_time=NOW()-INTERVAL 2 MINUTE WHERE id={receipt_id};")
        participant=sql(f'SELECT participant_id FROM submissions WHERE id={receipt_id};')
        cp=sql(f'SELECT contest_problem_id FROM submissions WHERE id={receipt_id};')
        sql(f"INSERT INTO submissions(user_id,problem_id,contest_id,contest_problem_id,participant_id,code,code_length,language,status,score,identity_type,identity_id,submit_time) VALUES({uid},{pid},{cid},{cp},{participant},'bad',3,'cpp17','WA',0,'PERSONAL',{uid},NOW()-INTERVAL 1 MINUTE);")
        sql(f"UPDATE contests SET end_time=NOW()-INTERVAL 1 SECOND,status='ENDED' WHERE id={cid};")
        http(f'/api/v1/contests/{cid}/scoreboard',token=token,expected=40003)
        http(f'/api/v1/contests/public/{cid}/scoreboard',expected=40003)
        check('end time alone never publishes internal or external scoreboard')
        update(cid,{'resultsPublished':True})
        board=http(f'/api/v1/contests/{cid}/scoreboard',token=token)
        assert board['rows'][0]['score']==0,board
        external=http(f'/api/v1/contests/public/{cid}/scoreboard')
        assert external['contestType']=='LANQIAO'
        check('manual release opens internal/external scores; latest lower-scoring submission is authoritative')
        update(cid,{'publicScoreboardEnabled':False})
        http(f'/api/v1/contests/public/{cid}/scoreboard',expected=40003)
        assert http(f'/api/v1/contests/{cid}/scoreboard',token=token)['type']=='LANQIAO'
        check('external-board switch independent of internal-board visibility')
        http(prefix+f'/contests/{cid}/rank/rebuild?mode=LANQIAO',{},admin)
        ranked=http(f'/api/v1/contests/{cid}/rank',token=token)
        assert ranked[0]['totalScore']==0,ranked
        check('legacy cached rank/rebuild endpoint also follows latest-submission score')
        # Confirm OI still takes the highest score rather than its last attempt.
        http(f"/api/v1/contests/{oi['id']}/register",{'identityType':'PERSONAL'},token)
        oi_cp=oi_problems[0]['contestProblemId']
        for points,status in [(34,'AC'),(0,'WA')]:
            sql(f"INSERT INTO submissions(user_id,problem_id,contest_id,contest_problem_id,code,language,status,score,identity_type,identity_id,submit_time) VALUES({uid},{pid},{oi['id']},{oi_cp},'oi','cpp17','{status}',{points},'PERSONAL',{uid},NOW());")
        assert http(f"/api/v1/contests/{oi['id']}/scoreboard",token=token)['rows'][0]['score']==34
        check('OI highest-score behavior preserved after latest-submission Lanqiao support')
        # Observe the real scheduler's WebSocket receipt, never raw JUDGING/SE.
        ws=websocket.create_connection(base.replace('http:','ws:')+'/ws',origin='http://127.0.0.1:5173',timeout=5)
        try:
            ws.send('CONNECT\naccept-version:1.2\nhost:localhost\nAuthorization:Bearer '+token+'\n\n\x00')
            assert 'CONNECTED' in ws.recv()
            ws.send(f'SUBSCRIBE\nid:lane\ndestination:/topic/submissions/{receipt_id}\n\n\x00')
            time.sleep(0.2)
            sql(f"UPDATE submissions SET status='AC',judge_worker_id=NULL WHERE id={receipt_id};")
            http(prefix+f'/submissions/{receipt_id}/rejudge',{},admin)
            frame=ws.recv()
            while 'MESSAGE' not in frame:
                frame=ws.recv()
            event=json.loads(frame.split('\n\n',1)[1].rstrip('\x00'))
            assert event['status']=='SUBMITTED' and event['time']==0 and event['memory']==0,event
            check('live STOMP scheduler event masks judge state and resource metrics')
        finally:
            ws.close()
        update(cid,{'scoreboardEnabled':False,'publicScoreboardEnabled':True})
        http(f'/api/v1/contests/{cid}/scoreboard',token=token,expected=40003)
        assert http(f'/api/v1/contests/public/{cid}/scoreboard')['contestType']=='LANQIAO'
        update(cid,{'scoreboardEnabled':True})
        check('public external board can remain enabled while internal board is disabled')
        # Teacher shares the administrative contest service and all fields.
        sql("INSERT INTO majors(code,name) VALUES('lane','Lanqiao major');")
        tid=int(sql("INSERT INTO teachers(username,password_hash,display_name,major_id) VALUES('lane_teacher','"+hashed+"','Teacher',(SELECT MAX(id) FROM majors)); SELECT LAST_INSERT_ID();"))
        challenge=http('/api/v1/captcha/image')
        teacher=http('/api/teacher/v1/auth/login',{'username':'lane_teacher','password':password,'captchaId':challenge['captchaId'],
            'captcha':redis('GET','oj:captcha:'+challenge['captchaId'])})['accessToken']
        teacher_contest=create(actor=teacher)
        assert teacher_contest['type']=='LANQIAO' and teacher_contest['scoreboardEnabled'] is False
        update(teacher_contest['id'],{'scoreboardEnabled':True,'publicScoreboardEnabled':True},teacher)
        check('teacher can create and edit Lanqiao contest and board settings through shared API')
        # Complete management board: score order, zero-submit entrants, star scores and unreleased/frozen results.
        managed_id=teacher_contest['id']
        managed_cps=http(prefix+f'/contests/{managed_id}/problems',token=teacher)
        highest=int(sql("INSERT INTO users(username,password_hash,role,display_name,email) VALUES('management_high','"+hashed+"','STUDENT','Management 100','high@example.invalid'); SELECT LAST_INSERT_ID();"))
        empty=int(sql("INSERT INTO users(username,password_hash,role,display_name,email) VALUES('management_empty','"+hashed+"','STUDENT','Management 0','empty@example.invalid'); SELECT LAST_INSERT_ID();"))
        sql(f"UPDATE users SET display_name='Management 70' WHERE id={uid}; UPDATE users SET display_name='Management 20' WHERE id={other};")
        for user,points,star in [(highest,[34,33,33],1),(uid,[30,20,20],0),(other,[20,0,0],0),(empty,None,0)]:
            sql(f"INSERT INTO contest_registrations(contest_id,user_id,identity_type,identity_id,status,starred) VALUES({managed_id},{user},'PERSONAL',{user},'APPROVED',{star});")
            part=int(sql(f"INSERT INTO contest_participants(contest_id,user_id,nickname,identity_type,identity_id,starred) VALUES({managed_id},{user},'Managed','PERSONAL',{user},{star}); SELECT LAST_INSERT_ID();"))
            if points is not None:
                for problem,score in zip(managed_cps,points):
                    managed_cp=problem['contestProblemId']
                    source=sql(f'SELECT problem_id FROM contest_problems WHERE id={managed_cp};')
                    sql(f"INSERT INTO submissions(user_id,problem_id,contest_id,contest_problem_id,participant_id,code,language,status,score,identity_type,identity_id,submit_time) VALUES({user},{source},{managed_id},{managed_cp},{part},'fixture','cpp17','WA',{score},'PERSONAL',{user},NOW());")
        sql(f"UPDATE contests SET frozen=1,freeze_time=NOW()-INTERVAL 30 MINUTE,scoreboard_enabled=0,public_scoreboard_enabled=0,results_published=0 WHERE id={managed_id};")
        for actor in [admin,teacher]:
            complete=http(prefix+f'/contests/{managed_id}/scoreboard',token=actor)
            assert [row['score'] for row in complete['rows']]==[100,70,20,0],complete
            assert [[cell['score'] for cell in row['cells']] for row in complete['rows']]==[[34,33,33],[30,20,20],[20,0,0],[0,0,0]]
            assert all(not cell['hasHiddenSubmissions'] for row in complete['rows'] for cell in row['cells'])
        check('administrator and owner teacher see complete score-descending board, per-problem scores, starred high scores and zero-submit entrants during freeze before release')
        http(prefix+f'/contests/{managed_id}/scoreboard',token=token,expected=403)
        http(prefix+f'/contests/{cid}/scoreboard',token=teacher,expected=40003)
        http(prefix+f'/contests/{managed_id}/scoreboard',expected=401)
        http(f'/api/v1/contests/{managed_id}/scoreboard',token=token,expected=40003)
        http(f'/api/v1/contests/public/{managed_id}/scoreboard',expected=40003)
        check('complete management board denies students, anonymous and unrelated teachers while front boards remain closed')
        (output/'management-scoreboard.json').write_text(json.dumps(complete,ensure_ascii=False,indent=2))

        if os.environ.get('QOJ_TEACHER_PARITY') == '1':
            from verify_teacher_management_http import verify_parity
            verify_parity(root, output, base, prefix, http, sql, check, teacher, admin, token, tid, uid, other, highest, empty, pid, sid, cid, managed_id)

        if os.environ.get('QOJ_IMPORT_PASSWORD_E2E') == '1':
            from verify_import_password_http import verify_import_password
            verify_import_password(output, base, prefix, http, sql, redis, check, admin, teacher, tid, hashed, password)

        if os.environ.get('QOJ_CONTEST_EDITOR_UI') == '1':
            for index in range(11):
                extra = int(sql(f"INSERT INTO users(username,password_hash,role,display_name,email) VALUES('ranking_extra_{index}','{hashed}','STUDENT','Extra {index}','extra{index}@example.invalid'); SELECT LAST_INSERT_ID();"))
                sql(f"INSERT INTO contest_registrations(contest_id,user_id,identity_type,identity_id,status) VALUES({managed_id},{extra},'PERSONAL',{extra},'APPROVED');")
            for index in range(12):
                sql(f"INSERT INTO contests(title,start_time,end_time,type,owner_id,owner_account_type,audience,status) VALUES('Pagination fixture {index}',NOW(),NOW()+INTERVAL 1 HOUR,'OI',{tid},'TEACHER','ALL','RUNNING');")
            board_class = 92847
            sql(f"INSERT INTO classes(id,name,teacher_id) VALUES({board_class},'Ranking class A',{tid});")
            sql(f"UPDATE users SET class_id={board_class} WHERE id IN ({uid},{highest});")
            sql(f"UPDATE problems SET owner_id={tid},owner_account_type='TEACHER' WHERE id IN ({','.join(map(str,problem_ids))});")
            folder = http(prefix+'/problem-folders', {'name':'Editor problems','accessScope':'ALL'}, teacher)
            http(prefix+f"/problem-folders/{folder['id']}/problems", {'problemIds':problem_ids}, teacher, method='PUT')
            ui_env = {**os.environ, 'QOJ_API_BASE':base, 'QOJ_API_PREFIX':prefix,
                'QOJ_ADMIN_TOKEN':admin, 'QOJ_TEACHER_TOKEN':teacher,
                'QOJ_MANAGED_ID':str(managed_id), 'QOJ_UNOWNED_CONTEST_ID':str(cid), 'QOJ_STUDENT_TOKEN':token, 'QOJ_E2E_OUTPUT':str(output)}
            subprocess.run(['node','tools/verify-contest-editor-ui.mjs'], cwd=root, env=ui_env, check=True)
            check('real browser: scoreboard-only tab, custom totals, reset to 100, persisted OI/Lanqiao create/edit and spacing in both portals')

        if os.environ.get('QOJ_LOGIN_UI') == '1':
            ui_env = {**os.environ, 'QOJ_API_BASE': base, 'QOJ_E2E_PASSWORD': password,
                'QOJ_E2E_REDIS_PASSWORD': environment.get('REDIS_PASSWORD', 'qoj-redis-change-me-2026').strip('\"\''),
                'QOJ_E2E_OUTPUT': str(output)}
            subprocess.run(['node', 'tools/verify-login-feedback-ui.mjs'], cwd=root, env=ui_env, check=True)
            check('real browser: public/admin/teacher login success feedback and failure without success notice')

        if os.environ.get('QOJ_LANQIAO_UI') == '1':
            sql(f"UPDATE contests SET end_time=NOW()+INTERVAL 1 HOUR,status='RUNNING',results_published=0 WHERE id={cid};")
            sql(f"UPDATE contests SET scoreboard_enabled=1 WHERE id={managed_id};")
            ui_env = {**os.environ, 'QOJ_API_BASE': base, 'QOJ_STUDENT_TOKEN': token,
                'QOJ_ADMIN_TOKEN': admin, 'QOJ_TEACHER_TOKEN': teacher, 'QOJ_CONTEST_ID': str(cid),
                'QOJ_TEACHER_CONTEST_ID': str(teacher_contest['id']), 'QOJ_CP_ID': str(cp), 'QOJ_MANAGED_ID': str(managed_id)}
            subprocess.run(['node', 'tools/verify-lanqiao-contest-ui.mjs'], cwd=root, env=ui_env, check=True)
            check('real browser: admin/teacher settings and student submission receipt')
        (output/'scoreboard.json').write_text(json.dumps(board,ensure_ascii=False,indent=2))

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
        (output/'list-fixture.json').write_text(json.dumps(public,ensure_ascii=False,indent=2))
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
        report = output / 'http-report.json'
        report.write_text(json.dumps({'passed': passed, 'checks': checks,
            'command': 'python3 tools/verify-lanqiao-contest-http.py',
            'scope': 'disposable local backend/database; no public target contacted'},
            ensure_ascii=False, indent=2))


if __name__ == '__main__':
    result = verify(Path(__file__).resolve().parents[1])
    print(json.dumps({'checks': len(result), 'passed': True}))
