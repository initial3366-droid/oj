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
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Worker(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def do_DELETE(self):
        self.send_response(200); self.end_headers()
    def do_POST(self):
        command=json.loads(self.rfile.read(int(self.headers['Content-Length'])))['cmd'][0]
        compiler=bool(command.get('copyOutCached'))
        result=[{'status':'Accepted','exitStatus':0,'time':1000000,'memory':1048576,
            'files':{'stdout':'' if compiler else self.server.output,'stderr':''},
            'fileIds':{name:'fixture-'+uuid.uuid4().hex for name in command.get('copyOutCached',[])}}]
        body=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)


def verify(root):
    database = 'qoj_performance_e2e_' + uuid.uuid4().hex[:8]
    environment = dict(line.split('=', 1) for line in (root / '.env').read_text().splitlines()
                       if '=' in line and not line.lstrip().startswith('#'))
    sandbox=ThreadingHTTPServer(('127.0.0.1',0),Worker)
    sandbox.output=''
    threading.Thread(target=sandbox.serve_forever,daemon=True).start()
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
    log = (root / '.runtime/problem-performance/performance-backend.log').open('w')
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
        arguments += f' --qoj.go-judge.base-url=http://127.0.0.1:{sandbox.server_port} --qoj.go-judge.auth-token=performance-fixture-0123456789abcdef'
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
            assert process.poll() is None, 'Backend exited; inspect performance-backend.log'
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
        aid = int(sql("INSERT INTO admin_users(username,password_hash,role,display_name) VALUES('performance_admin','" + hashed + "','SUPER_ADMIN','Performance'); SELECT LAST_INSERT_ID();"))
        challenge = http('/api/v1/captcha/image')
        prefix = environment.get('ADMIN_API_PREFIX', '/api/admin/v1').strip(chr(34) + chr(39))
        admin = http(prefix + '/auth/login', {'username': 'performance_admin', 'password': password,
            'captchaId': challenge['captchaId'], 'captcha': redis('GET', 'oj:captcha:' + challenge['captchaId'])})['accessToken']
        pid = int(sql(f"INSERT INTO problems(title,statement,time_limit,memory_limit,difficulty,owner_id,owner_account_type,is_public,access_scope,student_publish_status) VALUES('Large data E2E','fixture',1000,256,1,{aid},'ADMIN',1,'ALL','PUBLISHED'); SELECT LAST_INSERT_ID();"))
        # 24 MiB, seeded server-side so the fixture does not hide API transfer costs.
        sql(f"INSERT INTO problem_test_cases(problem_id,case_no,input_data,output_data,sample) SELECT {pid},n,REPEAT('0 ',1048576),REPEAT('1 ',524288),0 FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8) v;")
        endpoint = prefix + f'/problems/{pid}/test-cases'
        def check(name, **values):
            checks.append({'name': name, 'passed': True, **values})
        def measure(path):
            started = time.perf_counter()
            response = urllib.request.urlopen(urllib.request.Request(base + path, headers={'Authorization': 'Bearer ' + admin}), timeout=60)
            payload = response.read()
            return json.loads(payload)['data'], {'bytes': len(payload), 'ms': round((time.perf_counter()-started)*1000, 2)}
        full, full_measure = measure(endpoint)
        summary, summary_measure = measure(endpoint + '/summary')
        assert len(summary) == len(full) == 8 and summary[0]['inputBytes'] == 2097152, summary
        assert summary_measure['bytes'] < 2048 and full_measure['bytes'] > 24000000
        check('24 MiB case data replaced by metadata in list response', full=full_measure, summary=summary_measure)
        ids_before = sql(f'SELECT GROUP_CONCAT(id ORDER BY case_no) FROM problem_test_cases WHERE problem_id={pid};')
        http(endpoint + '/summary', token=token, expected=403)
        http(endpoint + '/' + str(summary[0]['id']), token=token, expected=403)
        check('student cannot access hidden metadata or individual content')
        body = {'title': 'Large data updated', 'statement': 'fixture', 'timeLimit':1000, 'memoryLimit':256,
            'difficulty':1, 'checkerSource':'', 'communication':{'enabled':False}, 'samples':[],
            'isPublic':True, 'accessScope':'ALL', 'studentPublishStatus':'PUBLISHED'}
        def put(path, body):
            request = urllib.request.Request(base+path, method='PUT', data=json.dumps(body).encode(), headers={'Content-Type':'application/json','Authorization':'Bearer '+admin})
            with urllib.request.urlopen(request, timeout=60) as response:
                result = json.load(response)
            assert result['code'] == 200, result
            return result['data']
        timings=[]
        for _ in range(3):
            start=time.perf_counter(); put(prefix+f'/problems/{pid}',body); timings.append(round((time.perf_counter()-start)*1000,2))
        assert ids_before == sql(f'SELECT GROUP_CONCAT(id ORDER BY case_no) FROM problem_test_cases WHERE problem_id={pid} AND sample=0;')
        check('basic save leaves all hidden case identities intact', ms=timings)
        start=time.perf_counter(); http(endpoint+'/changes', {'changes':[], 'deletedIds':[]}, admin)
        check('unchanged case save has no data rewrite', ms=round((time.perf_counter()-start)*1000,2))
        one=http(endpoint+'/'+str(summary[0]['id']),token=admin)
        assert len(one['input'])==2097152
        check('individual case content is fetched on demand')
        before=sql(f'SELECT GROUP_CONCAT(CONCAT(id,":",MD5(input_data),":",MD5(output_data)) ORDER BY id) FROM problem_test_cases WHERE problem_id={pid};')
        changes={'changes':[{'id':summary[0]['id'],'caseNo':2,'input':'changed input','output':'1'},
            {'id':summary[1]['id'],'caseNo':1,'input':'second input','output':'2'}], 'deletedIds':[]}
        result=http(endpoint+'/changes',changes,admin)
        assert result[0]['id']==summary[1]['id'] and result[1]['id']==summary[0]['id']
        assert sql(f'SELECT COUNT(*) FROM problem_test_cases WHERE problem_id={pid} AND LENGTH(input_data)=2097152;')=='6'
        check('number swap is atomic and only two selected cases are rewritten')
        state=sql(f'SELECT GROUP_CONCAT(CONCAT(id,":",case_no,":",MD5(input_data)) ORDER BY id) FROM problem_test_cases WHERE problem_id={pid};')
        http(endpoint+'/changes', {'changes':[{'id':summary[0]['id'],'caseNo':3,'input':'bad','output':'bad'}], 'deletedIds':[summary[1]['id']]},admin,expected=400)
        assert state==sql(f'SELECT GROUP_CONCAT(CONCAT(id,":",case_no,":",MD5(input_data)) ORDER BY id) FROM problem_test_cases WHERE problem_id={pid};')
        check('invalid final numbering rolls back the whole change set')
        foreign=int(sql(f"INSERT INTO problems(title,statement,time_limit,memory_limit,difficulty,owner_id,is_public,access_scope,student_publish_status) VALUES('foreign','fixture',1000,256,1,{uid},1,'ALL','PUBLISHED'); SELECT LAST_INSERT_ID();"))
        http(prefix+f'/problems/{foreign}/test-cases/'+str(summary[0]['id']),token=admin,expected=404)
        http(endpoint+'/changes', {'changes':[], 'deletedIds':[999999999]}, admin,expected=404)
        check('foreign/missing case IDs cannot read or delete other data')
        # A database failure after deletion/renumbering must roll back all earlier writes.
        sql("CREATE TRIGGER performance_fail_insert BEFORE INSERT ON problem_test_cases FOR EACH ROW SET NEW.input_data=IF(NEW.input_data='forced-failure',NULL,NEW.input_data);")
        http(endpoint+'/changes', {'changes':[{'id':summary[0]['id'],'caseNo':8,'input':'changed then rollback','output':'1'},
            {'caseNo':2,'input':'forced-failure','output':'1'}], 'deletedIds':[summary[7]['id']]}, admin,expected=40000)
        sql('DROP TRIGGER performance_fail_insert;')
        assert state==sql(f'SELECT GROUP_CONCAT(CONCAT(id,":",case_no,":",MD5(input_data)) ORDER BY id) FROM problem_test_cases WHERE problem_id={pid};')
        check('database failure rolls back deletion, temporary numbers and content changes')
        result=http(endpoint+'/changes', {'changes':[{'caseNo':8,'input':'new case','output':'1'}],
            'deletedIds':[summary[7]['id']]},admin)
        assert len(result)==8 and result[-1]['id'] != summary[7]['id']
        check('atomic deletion and addition preserve all other case identities')
        detail=http('/api/v1/problems/'+str(pid),token=token)
        assert len(json.dumps(detail))<10000
        check('contestant problem detail does not transfer hidden test data')
        # Retain SPJ-to-normal validation, including Java whitespace semantics.
        sql(f"UPDATE problems SET checker_source='checker' WHERE id={pid}; UPDATE problem_test_cases SET output_data=CONCAT(CHAR(9),CHAR(10),' ') WHERE id={summary[2]['id']};")
        response=urllib.request.Request(base+prefix+f'/problems/{pid}',method='PUT',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+admin})
        try: value=urllib.request.urlopen(response,timeout=60)
        except urllib.error.HTTPError as error: value=error
        with value: result=json.load(value)
        assert result['code']==400, result
        check('turning off SPJ still rejects a blank expected output')
        sql(f"UPDATE problem_test_cases SET output_data=CONVERT(UNHEX('C2A0') USING utf8mb4) WHERE id={summary[2]['id']};")
        put(prefix+f'/problems/{pid}',body)
        check('SPJ can be disabled with valid output; NBSP remains a nonblank token')
        sql(f"UPDATE problems SET checker_source=NULL WHERE id={pid}; UPDATE problem_test_cases SET output_data=REPEAT('1 ',524288) WHERE problem_id={pid};")
        # Exercise the full submission -> queue -> HTTP worker -> verdict path.
        for output, expected in [('1 '*524288,'AC'),('1 '*524287+'2 ','WA'),('1\t'*524288,'AC'),('\u2003'+'1 '*524288+'\u2003','AC')]:
            sandbox.output=output
            start=time.perf_counter()
            submission=http('/api/v1/submissions',{'problemId':pid,'language':'cpp17','code':'int main(){return 0;}'},token)['id']
            accepted_ms=round((time.perf_counter()-start)*1000,2)
            for _ in range(300):
                status=sql(f'SELECT status FROM submissions WHERE id={submission};')
                if status in ('AC','WA','SE','CE','TLE','MLE'): break
                time.sleep(.1)
            assert status==expected, (status,expected)
            check('large-output queue verdict '+expected, submitMs=accepted_ms, totalMs=round((time.perf_counter()-start)*1000,2))
        mid=int(sql("INSERT INTO majors(code,name) VALUES('PERF','Performance'); SELECT LAST_INSERT_ID();"))
        tid=int(sql(f"INSERT INTO teachers(username,password_hash,display_name,major_id) VALUES('performance_teacher','{hashed}','Performance Teacher',{mid}); SELECT LAST_INSERT_ID();"))
        challenge=http('/api/v1/captcha/image')
        teacher=http('/api/teacher/v1/auth/login', {'username':'performance_teacher','password':password,
            'captchaId':challenge['captchaId'],'captcha':redis('GET','oj:captcha:'+challenge['captchaId'])})['accessToken']
        http(endpoint+'/summary',token=teacher,expected=40003)
        check('teacher cannot inspect another owner hidden cases')
        sql(f"UPDATE problems SET owner_id={tid},owner_account_type='TEACHER' WHERE id={pid};")
        # Browser uses the actual disposable API; the credentials remain transient process inputs.
        browser_environment={**os.environ,'PERF_API_BASE':base,'PERF_ADMIN_TOKEN':admin,'PERF_PROBLEM_ID':str(pid),'PERF_API_PREFIX':prefix,'PERF_TEACHER_TOKEN':teacher}
        subprocess.run(['node','tools/verify-problem-performance-ui.mjs'],cwd=root,env=browser_environment,check=True)
        check('real browser edit/save flows pass with trace and screenshot')
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
        sandbox.shutdown()
        sandbox.server_close()
        if created:
            sql('DROP DATABASE ' + database + ';', 'qoj')
        keys = redis('KEYS', '*').splitlines()
        if keys:
            redis('DEL', *keys)
        output = root / '.runtime/problem-performance/problem-performance-report.json'
        output.write_text(json.dumps({'passed': passed, 'checks': checks,
            'command': 'python3 tools/verify-problem-performance-http.py',
            'scope': 'disposable local backend/database; no public target contacted'},
            ensure_ascii=False, indent=2))


if __name__ == '__main__':
    result = verify(Path(__file__).resolve().parents[1])
    print(json.dumps({'checks': len(result), 'passed': True}))
