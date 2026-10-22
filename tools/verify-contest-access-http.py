"""Repeatable local HTTP E2E; clones one contest and removes all fixtures in finally.
Requires local qoj-mysql and backend. Tokens stay in memory; no existing rows modified.
Run QOJ_SMOKE_PORT=18081 QOJ_TRUSTED_PROXY_TEST=1 for the explicitly trusted proxy case.
"""
from pathlib import Path
import base64, hashlib, hmac, json, os, subprocess, time, urllib.request, urllib.error, uuid
root = Path(__file__).resolve().parents[1]
settings = {}
for line in (root / '.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        settings[key.strip()] = value.strip().strip('\"\'')
settings.update(os.environ)
def sql(query):
    result = subprocess.run(['docker', 'exec', '-i', 'qoj-mysql', 'sh', '-c',
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -B qoj'], input=query,
        text=True, capture_output=True, check=True)
    return result.stdout.strip()
def token(uid, kind='USER'):
    b64 = lambda v: base64.urlsafe_b64encode(v).decode().rstrip('=')
    data = b64(json.dumps({'alg':'HS256','typ':'JWT'}).encode()) + '.' + b64(json.dumps({
        'sub':str(uid),'jti':str(uuid.uuid4()),'typ':'access','accountType':kind,
        'iat':int(time.time()),'exp':int(time.time())+600}).encode())
    return data+'.'+b64(hmac.new(settings['JWT_SECRET'].encode(), data.encode(), hashlib.sha256).digest())
checks=[]
port=os.environ.get('QOJ_SMOKE_PORT','18080')
trusted=os.environ.get('QOJ_TRUSTED_PROXY_TEST')=='1'
def get(path, expected, bearer=None, headers=None):
    hs=dict(headers or {})
    if bearer: hs['Authorization']='Bearer '+bearer
    try: response=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+port+path,headers=hs),timeout=30)
    except urllib.error.HTTPError as e: response=e
    body=json.load(response)
    checks.append({'path':path,'status':response.status,'code':body.get('code'),'expected':expected})
    assert response.status==expected,(path,response.status,body.get('message'))
    return body.get('data')
contest_id=None
try:
    source=int(sql('SELECT contest_id FROM contest_problems LIMIT 1;'))
    uid=int(sql("SELECT id FROM users WHERE role='STUDENT' AND status='NORMAL' LIMIT 1;"))
    columns=[line.split('\t')[0] for line in sql('DESCRIBE contests;').splitlines() if not line.startswith('id\t')]
    fields=','.join('`'+c+'`' for c in columns)
    contest_id=int(sql(f'INSERT INTO contests ({fields}) SELECT {fields} FROM contests WHERE id={source}; SELECT LAST_INSERT_ID();'))
    sql(f"UPDATE contests SET title='access-e2e-{uuid.uuid4().hex}',audience='ALL',audience_id=0,is_deleted=0,registration_password=NULL,allowed_ip_ranges=NULL,start_time=NOW()-INTERVAL 1 HOUR,end_time=NOW()+INTERVAL 1 HOUR,allow_after_end_view_problem=1,public_scoreboard_enabled=1,frozen=0,enable_rolling_scoreboard=0 WHERE id={contest_id}; INSERT INTO contest_audiences(contest_id,audience_type,audience_id) VALUES({contest_id},'ALL',0);")
    columns=[line.split('\t')[0] for line in sql('DESCRIBE contest_problems;').splitlines() if not line.startswith('id\t')]
    fields=','.join('`'+c+'`' for c in columns)
    expressions=','.join(str(contest_id) if c=='contest_id' else '`'+c+'`' for c in columns)
    cp=int(sql(f'INSERT INTO contest_problems ({fields}) SELECT {expressions} FROM contest_problems WHERE contest_id={source} LIMIT 1; SELECT LAST_INSERT_ID();'))
    auth=token(uid)
    prefix=f'/api/v1/contests/{contest_id}'
    proxy={'X-Real-IP':'127.0.0.1'} if trusted else {}
    for viewer in [None,auth]:
        data=get(prefix,200,viewer,proxy)
        assert not data['registered'] and not data['problems']
        for suffix in [f'/problems/{cp}','/scoreboard','/rank','/scoreboard/snapshot/FINAL']:
            get(prefix+suffix,403,viewer,proxy)
    sql(f"UPDATE contests SET end_time=NOW()-INTERVAL 1 MINUTE WHERE id={contest_id};")
    get(prefix+f'/problems/{cp}',403,auth,proxy)
    sql(f"INSERT INTO contest_registrations(contest_id,user_id,identity_type,identity_id,status) VALUES({contest_id},{uid},'PERSONAL',{uid},'PENDING');")
    get(prefix+'/scoreboard',403,auth,proxy)
    get(prefix+f'/problems/{cp}',403,auth,proxy)
    sql(f"UPDATE contest_registrations SET status='APPROVED' WHERE contest_id={contest_id};")
    get(prefix+f'/problems/{cp}',200,auth,proxy)
    get(prefix+'/scoreboard',200,auth,proxy)
    sql(f"UPDATE contests SET allow_after_end_view_problem=0 WHERE id={contest_id};")
    get(prefix+f'/problems/{cp}',403,auth,proxy)
    get(f'/api/v1/contests/public/{contest_id}/scoreboard',200,None,proxy)
    sql(f"UPDATE contests SET allowed_ip_ranges='10.20.0.0/16' WHERE id={contest_id};")
    spoof={'X-Real-IP':'10.20.1.2','X-Forwarded-For':'10.20.1.2'}
    get(prefix,200 if trusted else 403,auth,spoof)
    get(prefix,403,auth,{'X-Real-IP':'not-an-ip'})
    get(prefix,403,auth)
    get(prefix+'/scoreboard',200 if trusted else 403,auth,spoof)
    report={'passed':True,'trustedProxyMode':trusted,'checks':checks,'temporaryFixturesRemoved':True}
finally:
    if contest_id:
        sql(f'DELETE FROM contest_registrations WHERE contest_id={contest_id}; DELETE FROM contest_problems WHERE contest_id={contest_id}; DELETE FROM contest_audiences WHERE contest_id={contest_id}; DELETE FROM contests WHERE id={contest_id};')
out=root/'.runtime/contest-access-fix'/('http-trusted-proxy.json' if trusted else 'http-direct.json')
out.write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'passed':len(checks),'report':str(out)}))
